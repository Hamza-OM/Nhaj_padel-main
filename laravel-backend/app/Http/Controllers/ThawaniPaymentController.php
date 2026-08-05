<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\ThawaniPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ThawaniPaymentController extends Controller
{
    public function __construct(protected ThawaniPaymentService $thawaniService)
    {
    }

    /**
     * POST /api/payments/thawani/create-session  { bookingId, totalAmount }
     */
    public function createSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bookingId' => 'required|exists:bookings,id',
            'totalAmount' => 'nullable|numeric',
        ]);

        $booking = Booking::findOrFail($validated['bookingId']);

        $frontendUrl = config('cors.allowed_origins')[0] ?? env('FRONTEND_URL', 'http://localhost:5173');
        $result = $this->thawaniService->createCheckoutSession(
            $booking,
            $frontendUrl.'?payment=success',
            $frontendUrl.'?payment=cancel'
        );

        return response()->json([
            'success' => $result['success'],
            'sessionId' => $result['session_id'],
            'paymentUrl' => $result['payment_url'],
            'mode' => $result['mode'] === 'sandbox_fallback' ? 'sandbox' : $result['mode'],
            'rawApiResponse' => $result['raw_response'] ?? null,
            'thawaniPayloadSample' => $result['payload'] ?? null,
        ]);
    }

    /**
     * POST /api/payments/thawani/verify  { sessionId, status }
     *
     * Prefers Thawani's own Retrieve Session response as the authoritative source of
     * truth. Falls back to the client-supplied status only when the session can't be
     * retrieved from Thawani (e.g. locally-generated fallback sessions created when
     * the create-session call couldn't reach Thawani's sandbox) — this keeps the
     * Interactive Sandbox Simulator working offline while still trusting the real
     * API whenever it's reachable.
     */
    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sessionId' => 'required|string',
            'status' => 'required|in:paid,success,failed',
        ]);

        $booking = Booking::where('thawani_session_id', $validated['sessionId'])->first();

        if (! $booking) {
            return response()->json(['error' => 'Session not associated with any active booking'], 404);
        }

        $remoteSession = $this->thawaniService->retrieveSession($validated['sessionId']);
        $paymentStatus = $remoteSession['data']['payment_status'] ?? null;

        if ($paymentStatus === 'paid') {
            $booking->update(['payment_status' => 'paid']);
        } elseif (in_array($paymentStatus, ['unpaid', 'expired'], true)) {
            $booking->update([
                'payment_status' => 'failed',
                'booking_status' => 'cancelled',
            ]);
        } elseif (in_array($validated['status'], ['paid', 'success'], true)) {
            // Thawani session unreachable/inconclusive — trust the simulator's outcome.
            $booking->update(['payment_status' => 'paid']);
        } elseif ($validated['status'] === 'failed') {
            // A failed payment means no reservation was actually completed — cancel the
            // booking too so its court/slot is released back to the pool immediately,
            // instead of sitting "confirmed" and blocking the slot for everyone else.
            $booking->update([
                'payment_status' => 'failed',
                'booking_status' => 'cancelled',
            ]);
        }

        return response()->json([
            'success' => true,
            'booking' => new BookingResource($booking->load('items.court')),
        ]);
    }

    /**
     * POST /api/webhooks/thawani
     * Real Thawani server-to-server webhook (kept for production use).
     *
     * Verifies the HMAC-SHA256 signature per Thawani's docs when a webhook secret is
     * configured (Merchant Portal > Webhook config). Skipped when unset, which is
     * fine for local dev since there's no public URL for Thawani to call anyway.
     */
    public function webhook(Request $request): JsonResponse
    {
        $webhookSecret = config('services.thawani.webhook_secret');

        if ($webhookSecret) {
            $signature = $request->header('thawani-signature');
            $timestamp = $request->header('thawani-timestamp');
            $expected = hash_hmac('sha256', $request->getContent().'-'.$timestamp, $webhookSecret);

            if (! $signature || ! $timestamp || ! hash_equals($expected, $signature)) {
                return response()->json(['error' => 'Invalid webhook signature'], 401);
            }
        }

        $event = $request->input('event_type');
        $sessionId = $request->input('data.session_id');

        if (! $sessionId) {
            return response()->json(['status' => 'received']);
        }

        $booking = Booking::where('thawani_session_id', $sessionId)->first();

        if ($booking) {
            if ($event === 'checkout.completed') {
                $status = $request->input('data.payment_status');
                if ($status === 'paid') {
                    $booking->update(['payment_status' => 'paid']);
                } elseif (in_array($status, ['unpaid', 'expired'], true)) {
                    $booking->update([
                        'payment_status' => 'failed',
                        'booking_status' => 'cancelled',
                    ]);
                }
            } elseif ($event === 'payment.succeeded') {
                $booking->update(['payment_status' => 'paid']);
            } elseif ($event === 'payment.failed') {
                $booking->update([
                    'payment_status' => 'failed',
                    'booking_status' => 'cancelled',
                ]);
            }
            // 'checkout.created' and 'payment.pending' are no-ops — the booking already
            // starts in a pending payment_status when it's created.
        }

        return response()->json(['status' => 'received']);
    }
}
