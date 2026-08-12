<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingResource;
use App\Services\BookingNotificationService;
use App\Services\BookingService;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerBookingController extends Controller
{
    public function __construct(
        protected BookingService $bookingService,
        protected PricingService $pricingService,
        protected BookingNotificationService $notifications
    ) {
    }

    /**
     * GET /api/slots/availability?date=YYYY-MM-DD
     * Requirement #3: Pooled (anonymous) slot availability for a date.
     */
    public function availability(Request $request): JsonResponse
    {
        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
        ]);

        $dateStr = $request->query('date', now()->format('Y-m-d'));
        $data = $this->bookingService->getPooledAvailability($dateStr);

        return response()->json([
            'date' => $data['date'],
            'totalCourtsCount' => $data['total_active_courts'],
            'slots' => array_map(fn ($slot) => [
                'time' => $slot['time'],
                'endTime' => $slot['end_time'],
                'availableCourtsCount' => $slot['available_courts_count'],
                'totalActiveCourts' => $slot['total_active_courts'],
                'isAvailable' => $slot['is_available'],
                'reasonIfUnavailable' => $slot['reason'],
            ], $data['slots']),
        ]);
    }

    /**
     * POST /api/pricing/calculate  { totalHours }
     * Requirement #1: Tiered rate calculation preview.
     */
    public function calculatePricing(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'totalHours' => 'required|integer|min:1',
        ]);

        $result = $this->pricingService->calculatePricing((int) $validated['totalHours']);

        return response()->json([
            'totalHours' => $result['total_hours'],
            'subtotal' => $result['subtotal'],
            'effectiveRatePerHour' => $result['effective_rate_per_hour'],
            'discountAmount' => $result['discount_amount'],
            'finalTotal' => $result['final_total'],
            'tierApplied' => $result['tier_applied'],
        ]);
    }

    /**
     * POST /api/bookings
     * Requirement #2 & #3: Place cart booking with random court assignment.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customerPhone' => 'required|string|min:7',
            'customerName' => 'nullable|string|max:100',
            'customerEmail' => 'nullable|email|max:100',
            'paymentMethod' => 'required|in:arrival,thawani',
            'cartItems' => 'required|array|min:1',
            'cartItems.*.date' => 'required|date_format:Y-m-d',
            'cartItems.*.time' => 'required|string',
            'cartItems.*.endTime' => 'required|string',
            'cartItems.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            $booking = $this->bookingService->createBooking([
                'customer_phone' => $validated['customerPhone'],
                'customer_name' => $validated['customerName'] ?? null,
                'customer_email' => $validated['customerEmail'] ?? null,
                'payment_method' => $validated['paymentMethod'],
                'cart_items' => array_map(fn ($item) => [
                    'date' => $item['date'],
                    'time' => $item['time'],
                    'end_time' => $item['endTime'],
                    'quantity' => $item['quantity'],
                ], $validated['cartItems']),
            ]);

            // Pay-on-arrival bookings are confirmed the moment they're created,
            // so the confirmation goes out now. Thawani bookings start as
            // pending_payment and are emailed from ThawaniPaymentController
            // only once the payment actually settles.
            if ($booking->payment_method === 'arrival') {
                $this->notifications->sendConfirmation($booking);
            }

            return response()->json([
                'success' => true,
                'message' => 'Booking successfully confirmed!',
                'booking' => new BookingResource($booking),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 409);
        }
    }

    /**
     * GET /api/bookings/lookup?reference=PAD-XXXXX&phone=9xxxxxxx
     * Lets a customer retrieve their own booking without an account.
     */
    public function lookup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reference' => 'required|string|max:20',
            'phone' => 'required|string|min:7|max:20',
        ]);

        $booking = $this->bookingService->findForCustomer($validated['reference'], $validated['phone']);

        if (! $booking) {
            // Deliberately vague: don't reveal whether the reference exists but the
            // phone didn't match, which would confirm a valid reference code.
            return response()->json([
                'error' => 'No booking found for that reference code and phone number.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'booking' => new BookingResource($booking),
            'cancellationWindowHours' => BookingService::CANCELLATION_WINDOW_HOURS,
        ]);
    }

    /**
     * POST /api/bookings/cancel  { reference, phone }
     * Customer self-service cancellation, subject to the published policy.
     */
    public function cancel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reference' => 'required|string|max:20',
            'phone' => 'required|string|min:7|max:20',
        ]);

        $booking = $this->bookingService->findForCustomer($validated['reference'], $validated['phone']);

        if (! $booking) {
            return response()->json([
                'error' => 'No booking found for that reference code and phone number.',
            ], 404);
        }

        try {
            $booking = $this->bookingService->cancelForCustomer($booking);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Your booking has been cancelled.',
            'booking' => new BookingResource($booking),
        ]);
    }
}
