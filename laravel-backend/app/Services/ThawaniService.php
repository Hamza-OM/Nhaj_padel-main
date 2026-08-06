<?php

namespace App\Services;

use App\Exceptions\PaymentGatewayException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Thawani E-Commerce Checkout integration.
 *
 * Talks to the real Thawani REST API — there is deliberately no offline
 * fallback. If Thawani cannot create a session the caller gets an exception
 * and the customer is told payment is unavailable, rather than being handed a
 * fabricated session id that can never be settled.
 *
 * Endpoints and field names below are the ones verified against the UAT
 * environment, not guesses:
 *   POST /checkout/session        -> { data: { session_id, payment_status, invoice, ... } }
 *   GET  /checkout/session/{id}   -> { data: { payment_status, invoice, total_amount, ... } }
 */
class ThawaniService
{
    /**
     * Thawani's own payment_status values.
     * "unpaid" is the INITIAL state of every session — it means "not settled yet",
     * NOT failure. Only expiry/cancellation are terminal negatives.
     */
    public const STATUS_UNPAID = 'unpaid';
    public const STATUS_PAID = 'paid';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_EXPIRED = 'expired';

    protected string $secretKey;
    protected string $publishableKey;
    protected string $baseUrl;
    protected string $checkoutPageUrl;
    protected bool $isProduction;

    public function __construct()
    {
        $this->secretKey = (string) config('services.thawani.secret_key');
        $this->publishableKey = (string) config('services.thawani.publishable_key');
        $this->isProduction = config('services.thawani.mode') === 'production';

        $configuredBase = config('services.thawani.base_url');
        $this->baseUrl = rtrim($configuredBase ?: ($this->isProduction
            ? 'https://checkoutapi.thawani.om/api/v1'
            : 'https://uatcheckout.thawani.om/api/v1'), '/');

        $this->checkoutPageUrl = rtrim(config('services.thawani.checkout_url') ?: ($this->isProduction
            ? 'https://checkout.thawani.om/pay'
            : 'https://uatcheckout.thawani.om/pay'), '/');
    }

    /**
     * Create a checkout session. Throws rather than inventing a session id.
     *
     * @param  array{name:string,amount_baisa:int}  $product
     * @return array{session_id:string,payment_url:string,invoice:?string,raw:array}
     */
    public function createCheckoutSession(
        string $clientReferenceId,
        array $product,
        string $successUrl,
        string $cancelUrl,
        array $metadata = []
    ): array {
        $this->assertConfigured();

        $payload = [
            'client_reference_id' => $clientReferenceId,
            'mode' => 'payment',
            'products' => [[
                'name' => $product['name'],
                'quantity' => 1,
                'unit_amount' => $product['amount_baisa'],
            ]],
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'metadata' => $metadata,
        ];

        try {
            $response = Http::withHeaders([
                'thawani-api-key' => $this->secretKey,
                'Content-Type' => 'application/json',
            ])->timeout(20)->post("{$this->baseUrl}/checkout/session", $payload);
        } catch (Throwable $e) {
            Log::error('Thawani: checkout session request failed', [
                'reference' => $clientReferenceId,
                'reason' => $e->getMessage(),
            ]);
            throw new PaymentGatewayException('Could not reach Thawani: '.$e->getMessage(), 0, $e);
        }

        if (! $response->successful()) {
            Log::error('Thawani: checkout session rejected', [
                'reference' => $clientReferenceId,
                'http_status' => $response->status(),
                'description' => $response->json('description'),
            ]);
            throw new PaymentGatewayException(
                "Thawani rejected the session request (HTTP {$response->status()})"
            );
        }

        $data = $response->json('data') ?? [];
        $sessionId = $data['session_id'] ?? null;

        if (! $sessionId) {
            Log::error('Thawani: response contained no session_id', ['reference' => $clientReferenceId]);
            throw new PaymentGatewayException('Thawani returned no session id');
        }

        Log::info('Thawani checkout session created', [
            'reference' => $clientReferenceId,
            'session_id' => $sessionId,
            'invoice' => $data['invoice'] ?? null,
        ]);

        return [
            'session_id' => $sessionId,
            'payment_url' => $this->paymentUrlFor($sessionId),
            'invoice' => $data['invoice'] ?? null,
            'raw' => $data,
        ];
    }

    /**
     * Authoritative status lookup. Returns null when the session cannot be read,
     * which callers must treat as "unknown" — never as failure.
     */
    public function retrieveSession(string $sessionId): ?array
    {
        $this->assertConfigured();

        try {
            $response = Http::withHeaders(['thawani-api-key' => $this->secretKey])
                ->timeout(20)
                ->get("{$this->baseUrl}/checkout/session/{$sessionId}");
        } catch (Throwable $e) {
            Log::warning('Thawani: session lookup failed', [
                'session_id' => $sessionId,
                'reason' => $e->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('Thawani: session lookup returned an error', [
                'session_id' => $sessionId,
                'http_status' => $response->status(),
            ]);

            return null;
        }

        return $response->json('data');
    }

    /**
     * Map Thawani's payment_status onto our payment status vocabulary.
     * Returns null when the state is not yet terminal (i.e. still "unpaid"),
     * so callers leave the payment pending instead of settling it.
     */
    public function mapStatus(?string $thawaniStatus): ?string
    {
        return match ($thawaniStatus) {
            self::STATUS_PAID => 'paid',
            self::STATUS_CANCELLED => 'cancelled',
            self::STATUS_EXPIRED => 'expired',
            default => null, // unpaid / unknown → still in flight
        };
    }

    public function paymentUrlFor(string $sessionId): string
    {
        return "{$this->checkoutPageUrl}/{$sessionId}?key={$this->publishableKey}";
    }

    /** OMR is quoted in baisa (1 OMR = 1000 baisa), confirmed against UAT. */
    public function toBaisa(float $omr): int
    {
        return (int) round($omr * 1000);
    }

    protected function assertConfigured(): void
    {
        if ($this->secretKey === '' || $this->publishableKey === '') {
            throw new PaymentGatewayException('Thawani credentials are not configured');
        }
    }
}
