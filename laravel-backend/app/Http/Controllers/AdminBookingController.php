<?php

namespace App\Http\Controllers;

use App\Http\Resources\AdminBookingResource;
use App\Models\Booking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminBookingController extends Controller
{
    /**
     * GET /api/admin/bookings?date=&status=&paymentMethod=&phone=&courtId=
     */
    public function index(Request $request): JsonResponse
    {
        $query = Booking::with('items.court');

        if ($request->filled('date')) {
            $query->where('booking_date', $request->date);
        }

        if ($request->filled('status') && $request->status !== 'ALL') {
            // Nothing ever writes booking_status = 'completed' — a confirmed booking is
            // considered completed once its date has passed. Derive it here so the
            // "Completed" filter (and the status shown per row) actually reflects that.
            $today = now()->format('Y-m-d');

            if ($request->status === 'completed') {
                $query->where('booking_status', 'confirmed')->where('booking_date', '<', $today);
            } elseif ($request->status === 'confirmed') {
                $query->where('booking_status', 'confirmed')->where('booking_date', '>=', $today);
            } else {
                $query->where('booking_status', $request->status);
            }
        }

        if ($request->filled('paymentMethod') && $request->paymentMethod !== 'ALL') {
            $query->where('payment_method', $request->paymentMethod);
        }

        if ($request->filled('phone')) {
            // Despite the param name, the frontend search box matches phone, reference
            // code, customer name, and email — mirror that here so results aren't
            // silently narrowed to phone-only before the client's own filtering runs.
            $search = trim($request->phone);
            $query->where(function ($q) use ($search) {
                $q->where('customer_phone', 'like', "%{$search}%")
                    ->orWhere('reference_code', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('courtId') && $request->courtId !== 'ALL') {
            $query->whereHas('items', fn ($q) => $q->where('court_id', $request->courtId));
        }

        $bookings = $query->orderBy('created_at', 'desc')->get();

        return response()->json(AdminBookingResource::collection($bookings));
    }

    /**
     * POST /api/admin/bookings/{booking}/cancel
     */
    public function cancel(Booking $booking): JsonResponse
    {
        if ($booking->booking_status === 'cancelled') {
            return response()->json(['error' => 'Booking is already cancelled'], 422);
        }

        $booking->update(['booking_status' => 'cancelled']);

        return response()->json([
            'success' => true,
            'message' => 'Booking cancelled successfully',
            'booking' => new AdminBookingResource($booking->load('items.court')),
        ]);
    }

    /**
     * POST /api/admin/bookings/{booking}/settle  { outcome: paid|no_show }
     *
     * Records what happened at the counter for a pay-on-arrival booking.
     *
     * Online bookings settle themselves — Thawani tells us whether the money
     * arrived. Cash at reception has no such signal, so without this the
     * payment sat at 'pending' forever: revenue never counted a single riyal
     * taken in person, and every past session piled up as "expected" whether
     * the customer paid, or never turned up at all.
     */
    public function settle(Request $request, Booking $booking): JsonResponse
    {
        $validated = $request->validate([
            'outcome' => 'required|in:paid,no_show',
        ]);

        if ($booking->payment_method !== 'arrival') {
            return response()->json([
                'error' => 'Only pay-on-arrival bookings are settled by hand; online payments are confirmed by the gateway.',
            ], 422);
        }

        if ($booking->booking_status === 'cancelled') {
            return response()->json(['error' => 'This booking was cancelled.'], 422);
        }

        if ($booking->payment_status === 'paid') {
            return response()->json(['error' => 'This booking is already marked as paid.'], 422);
        }

        // 'cancelled' rather than 'failed': nothing was attempted and went
        // wrong — the customer simply never showed up to pay.
        $status = $validated['outcome'] === 'paid' ? 'paid' : 'cancelled';

        $booking->update(['payment_status' => $status]);
        $booking->payments()->latest()->first()?->update(['status' => $status]);

        return response()->json([
            'success' => true,
            'message' => $status === 'paid' ? 'Marked as paid.' : 'Marked as a no-show.',
            'booking' => new AdminBookingResource($booking->fresh()->load('items.court')),
        ]);
    }
}
