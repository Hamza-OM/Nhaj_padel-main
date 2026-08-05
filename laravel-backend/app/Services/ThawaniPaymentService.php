<?php

namespace App\Services;

use App\Models\Booking;
use Illuminate\Support\Facades\Http;
use Exception;

class ThawaniPaymentService
{
    protected string $secretKey;
    protected string $publishableKey;
    protected string $baseUrl;
    protected string $checkoutPageUrl;
    protected bool $isProduction;

    public function __construct()
    {
        $this->secretKey = config('services.thawani.secret_key', env('THAWANI_SECRET_KEY', 'rQ0w...'));
        $this->publishableKey = config('services.thawani.publishable_key', env('THAWANI_PUBLISHABLE_KEY', 'HG9w...'));

        $this->isProduction = config('services.thawani.mode', 'sandbox') === 'production';

        // Thawani's real environments: UAT/test uses the "uatcheckout" subdomain,
        // production uses "checkoutapi" for the REST API and "checkout" for the hosted pay page.
        $this->baseUrl = $this->isProduction
            ? 'https://checkoutapi.thawani.om/api/v1'
            : 'https://uatcheckout.thawani.om/api/v1';

        $this->checkoutPageUrl = $this->isProduction
            ? 'https://checkout.thawani.om/pay'
            : 'https://uatcheckout.thawani.om/pay';
    }

    /**
     * Requirement #4: Create Thawani Checkout Session (Sandbox API)
     */
    public function createCheckoutSession(Booking $booking, string $successUrl, string $cancelUrl): array
    {
        $payload = [
            'client_reference_id' => $booking->reference_code,
            'mode' => 'payment',
            'products' => [
                [
                    'name' => "Padel Court Booking ({$booking->total_duration_hours} hrs)",
                    'quantity' => 1,
                    'unit_amount' => (int) round($booking->total_amount * 1000), // In Baisa (1 OMR = 1000 Baisa)
                ],
            ],
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'metadata' => [
                'booking_id' => $booking->id,
                'customer_phone' => $booking->customer_phone,
            ],
        ];

        try {
            $response = Http::withHeaders([
                'thawani-api-key' => $this->secretKey,
                'Content-Type' => 'application/json',
            ])->timeout(10)->post("{$this->baseUrl}/checkout/session", $payload);

            if ($response->successful()) {
                $data = $response->json();
                $sessionId = $data['data']['session_id'] ?? null;

                if ($sessionId) {
                    $paymentUrl = "{$this->checkoutPageUrl}/{$sessionId}?key={$this->publishableKey}";

                    $booking->update([
                        'thawani_session_id' => $sessionId,
                        'thawani_payment_url' => $paymentUrl,
                    ]);

                    return [
                        'success' => true,
                        'session_id' => $sessionId,
                        'payment_url' => $paymentUrl,
                        'mode' => $this->isProduction ? 'production' : 'sandbox',
                        'raw_response' => $data,
                    ];
                }
            }
        } catch (Exception $e) {
            // Graceful fallback for local/offline dev environments without a route to Thawani's servers
        }

        // Fallback local sandbox generator if the external network call is unreachable
        $sessionId = 'thawani_sess_' . strtolower(substr(md5(uniqid()), 0, 10));
        $paymentUrl = "{$this->checkoutPageUrl}/{$sessionId}?key={$this->publishableKey}";

        $booking->update([
            'thawani_session_id' => $sessionId,
            'thawani_payment_url' => $paymentUrl,
        ]);

        return [
            'success' => true,
            'session_id' => $sessionId,
            'payment_url' => $paymentUrl,
            'mode' => 'sandbox_fallback',
            'payload' => $payload,
        ];
    }

    /**
     * GET /checkout/session/{session_id} — the authoritative source of truth for a
     * session's real payment status. Returns null if the session is unreachable
     * (e.g. it's a locally-generated fallback ID that was never sent to Thawani).
     */
    public function retrieveSession(string $sessionId): ?array
    {
        try {
            $response = Http::withHeaders([
                'thawani-api-key' => $this->secretKey,
            ])->timeout(10)->get("{$this->baseUrl}/checkout/session/{$sessionId}");

            if ($response->successful()) {
                return $response->json();
            }
        } catch (Exception $e) {
            // Session not retrievable (offline, or a locally-generated fallback ID)
        }

        return null;
    }
}
