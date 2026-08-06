<?php

namespace App\Http\Controllers;

use App\Exceptions\PaymentGatewayException;
use App\Http\Resources\UnverifiedBookingResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\ThawaniService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ThawaniPaymentController extends Controller
{
    public function __construct(protected ThawaniService $thawani)
    {
    }

    /**
     * POST /api/payments/thawani/create-session  { bookingId }
     *
     * Creates a genuine Thawani checkout session and returns only what the
     * browser needs to redirect. Idempotent: pressing "Confirm & Pay" twice
     * reuses the still-open session rather than orphaning the first one.
     *
     * Note there is no amount in the request — the total comes from the booking
     * the server priced. Anything the client sends about money is ignored.
     */
    public function createSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bookingId' => 'required|exists:bookings,id',
        ]);

        $booking = Booking::findOrFail($validated['bookingId']);

        if ($booking->booking_status === 'cancelled') {
            return response()->json(['error' => 'This booking has been cancelled.'], 422);
        }

        if ($booking->payment_status === 'paid') {
            return response()->json(['error' => 'This booking has already been paid.'], 422);
        }

        // Reuse an open session if we already have one for this booking.
        $existing = $booking->payments()
            ->where('method', 'thawani')
            ->where('status', 'pending')
            ->whereNotNull('provider_session_id')
            ->latest()
            ->first();

        if ($existing) {
            $session = $this->thawani->retrieveSession($existing->provider_session_id);
            $mapped = $this->thawani->mapStatus($session['payment_status'] ?? null);

            if ($mapped === null && $session !== null) {
                // Still unpaid and live — send them back to the same checkout.
                return response()->json([
                    'sessionId' => $existing->provider_session_id,
                    'paymentUrl' => $this->thawani->paymentUrlFor($existing->provider_session_id),
                ]);
            }

            if ($mapped !== null) {
                // It already reached a terminal state; record that before retrying.
                $this->settle($existing, $session);

                if ($mapped === 'paid') {
                    return response()->json(['error' => 'This booking has already been paid.'], 422);
                }
            }
        }

        $payment = $booking->payments()
            ->where('method', 'thawani')
            ->where('status', 'pending')
            ->whereNull('provider_session_id')
            ->latest()
            ->first();

        // Previous attempt was cancelled/expired — start a fresh one.
        $payment ??= Payment::create([
            'booking_id' => $booking->id,
            'method' => 'thawani',
            'status' => 'pending',
            'amount' => $booking->total_amount,
            'currency' => $booking->currency,
            'provider' => 'thawani',
        ]);

        $frontendUrl = rtrim(config('app.frontend_url'), '/');

        try {
            $session = $this->thawani->createCheckoutSession(
                clientReferenceId: $booking->reference_code,
                product: [
                    'name' => "Padel Court Booking ({$booking->total_duration_hours} hrs)",
                    'amount_baisa' => $this->thawani->toBaisa((float) $booking->total_amount),
                ],
                successUrl: "{$frontendUrl}/payment/result?ref={$booking->reference_code}",
                cancelUrl: "{$frontendUrl}/payment/result?ref={$booking->reference_code}&cancelled=1",
                metadata: [
                    'booking_id' => (string) $booking->id,
                    'reference' => $booking->reference_code,
                ],
            );
        } catch (PaymentGatewayException $e) {
            // Logged inside the service with detail; the customer gets none of it.
            return response()->json([
                'error' => 'Online payment is temporarily unavailable. Please try again or choose Pay on Arrival.',
            ], 502);
        }

        $payment->update([
            'provider_session_id' => $session['session_id'],
            'provider_transaction_id' => $session['invoice'],
            'metadata' => ['checkout_created_at' => now()->toIso8601String()],
        ]);

        return response()->json([
            'sessionId' => $session['session_id'],
            'paymentUrl' => $session['payment_url'],
        ]);
    }

    /**
     * GET /api/payments/thawani/result?reference=PAD-XXXXX
     *
     * Called when Thawani returns the customer to us. Landing on the success URL
     * proves nothing, so the real status is fetched from Thawani here and the
     * booking is updated from that — never from the URL the browser arrived on.
     */
    public function result(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reference' => 'required|string|max:20',
        ]);

        $booking = Booking::where('reference_code', strtoupper(trim($validated['reference'])))->first();

        if (! $booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        $payment = $booking->payments()->where('method', 'thawani')->latest()->first();

        if ($payment && $payment->provider_session_id && ! $payment->isSettled()) {
            $session = $this->thawani->retrieveSession($payment->provider_session_id);
            $this->settle($payment, $session);
            $booking->refresh();
            $payment->refresh();
        }

        return response()->json([
            'paymentStatus' => $payment?->status ?? $booking->payment_status,
            'bookingStatus' => $booking->booking_status,
            'booking' => new UnverifiedBookingResource($booking->load('items')),
        ]);
    }

    /**
     * POST /api/webhooks/thawani
     *
     * Server-to-server notification. The payload is only a hint — we always
     * confirm against Thawani before touching the database, and settling is
     * idempotent so a replayed webhook changes nothing.
     */
    public function webhook(Request $request): JsonResponse
    {
        $secret = config('services.thawani.webhook_secret');

        if ($secret) {
            $signature = $request->header('thawani-signature');
            $timestamp = $request->header('thawani-timestamp');
            $expected = hash_hmac('sha256', $request->getContent().'-'.$timestamp, $secret);

            if (! $signature || ! $timestamp || ! hash_equals($expected, $signature)) {
                Log::warning('Thawani webhook rejected: bad signature');

                return response()->json(['error' => 'Invalid signature'], 401);
            }
        }

        $event = $request->input('event_type');
        $sessionId = $request->input('data.session_id');

        if (! $sessionId) {
            return response()->json(['status' => 'ignored']);
        }

        $payment = Payment::where('provider_session_id', $sessionId)->first();

        if (! $payment) {
            Log::info('Thawani webhook for unknown session', ['event' => $event, 'session_id' => $sessionId]);

            return response()->json(['status' => 'ignored']);
        }

        // checkout.created / payment.pending carry no settlement information.
        if (in_array($event, ['checkout.created', 'payment.pending'], true)) {
            return response()->json(['status' => 'acknowledged']);
        }

        $session = $this->thawani->retrieveSession($sessionId);
        $this->settle($payment, $session);

        return response()->json(['status' => 'processed']);
    }

    /**
     * Apply Thawani's verdict to a payment and its booking, exactly once.
     *
     * Locks the payment row so concurrent webhook deliveries and return-URL hits
     * cannot both transition it, and returns early if it is already settled.
     */
    protected function settle(Payment $payment, ?array $sessionData): void
    {
        $mapped = $this->thawani->mapStatus($sessionData['payment_status'] ?? null);

        // Unknown or still "unpaid" — leave everything pending. Critically, an
        // unpaid session must NOT cancel the booking: it just means the customer
        // has not finished paying yet.
        if ($mapped === null) {
            return;
        }

        DB::transaction(function () use ($payment, $sessionData, $mapped) {
            $fresh = Payment::whereKey($payment->getKey())->lockForUpdate()->first();

            if (! $fresh || $fresh->isSettled()) {
                return; // Already handled by an earlier delivery.
            }

            $fresh->update([
                'status' => $mapped,
                'provider_transaction_id' => $sessionData['invoice'] ?? $fresh->provider_transaction_id,
                'metadata' => array_merge($fresh->metadata ?? [], [
                    'settled_at' => now()->toIso8601String(),
                    'thawani_payment_status' => $sessionData['payment_status'] ?? null,
                ]),
            ]);

            $booking = Booking::whereKey($fresh->booking_id)->lockForUpdate()->first();

            if (! $booking) {
                return;
            }

            if ($mapped === 'paid') {
                $booking->update([
                    'payment_status' => 'paid',
                    'booking_status' => 'confirmed',
                ]);
            } else {
                // cancelled / expired — release the slots back to the pool.
                $booking->update([
                    'payment_status' => $mapped,
                    'booking_status' => 'cancelled',
                ]);
            }

            Log::info('Payment settled', [
                'payment_id' => $fresh->id,
                'booking_reference' => $booking->reference_code,
                'status' => $mapped,
            ]);
        });

        $payment->refresh();
    }
}
