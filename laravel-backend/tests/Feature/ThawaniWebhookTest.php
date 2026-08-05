<?php

namespace Tests\Feature;

use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ThawaniWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function makeBooking(string $sessionId, string $paymentStatus = 'pending', string $bookingStatus = 'confirmed'): Booking
    {
        return Booking::create([
            'reference_code' => 'PAD-' . strtoupper(substr(md5($sessionId), 0, 5)),
            'customer_phone' => '99999999',
            'booking_date' => now()->addDay()->toDateString(),
            'total_duration_hours' => 1,
            'subtotal_amount' => 10,
            'total_amount' => 10,
            'payment_method' => 'thawani',
            'payment_status' => $paymentStatus,
            'booking_status' => $bookingStatus,
            'thawani_session_id' => $sessionId,
        ]);
    }

    protected function signedHeaders(array $payload, string $secret = 'test_webhook_secret_for_phpunit'): array
    {
        $body = json_encode($payload);
        $timestamp = (string) time();

        return [
            'thawani-timestamp' => $timestamp,
            'thawani-signature' => hash_hmac('sha256', $body . '-' . $timestamp, $secret),
        ];
    }

    public function test_valid_signature_with_checkout_completed_paid_marks_booking_paid(): void
    {
        $booking = $this->makeBooking('sess_valid_paid');

        $payload = [
            'event_type' => 'checkout.completed',
            'data' => ['session_id' => 'sess_valid_paid', 'payment_status' => 'paid'],
        ];

        $response = $this->postJson('/api/webhooks/thawani', $payload, $this->signedHeaders($payload));

        $response->assertOk();
        $this->assertSame('paid', $booking->fresh()->payment_status);
    }

    public function test_payment_failed_event_cancels_the_booking(): void
    {
        $booking = $this->makeBooking('sess_failed');

        $payload = [
            'event_type' => 'payment.failed',
            'data' => ['session_id' => 'sess_failed'],
        ];

        $response = $this->postJson('/api/webhooks/thawani', $payload, $this->signedHeaders($payload));

        $response->assertOk();
        $booking->refresh();
        $this->assertSame('failed', $booking->payment_status);
        $this->assertSame('cancelled', $booking->booking_status);
    }

    public function test_invalid_signature_is_rejected_and_booking_is_untouched(): void
    {
        $booking = $this->makeBooking('sess_bad_sig');

        $payload = [
            'event_type' => 'checkout.completed',
            'data' => ['session_id' => 'sess_bad_sig', 'payment_status' => 'paid'],
        ];

        $response = $this->postJson('/api/webhooks/thawani', $payload, [
            'thawani-timestamp' => (string) time(),
            'thawani-signature' => 'not-the-real-signature',
        ]);

        $response->assertStatus(401);
        $this->assertSame('pending', $booking->fresh()->payment_status);
    }

    public function test_missing_signature_headers_are_rejected(): void
    {
        $booking = $this->makeBooking('sess_no_sig');

        $payload = [
            'event_type' => 'checkout.completed',
            'data' => ['session_id' => 'sess_no_sig', 'payment_status' => 'paid'],
        ];

        $response = $this->postJson('/api/webhooks/thawani', $payload);

        $response->assertStatus(401);
        $this->assertSame('pending', $booking->fresh()->payment_status);
    }

    public function test_verify_prefers_thawanis_real_session_status_over_the_client_supplied_status(): void
    {
        Http::fake([
            'https://uatcheckout.thawani.om/api/v1/checkout/session/*' => Http::response([
                'data' => ['payment_status' => 'paid'],
            ], 200),
        ]);

        $booking = $this->makeBooking('sess_real_paid');

        // Client claims the payment failed, but Thawani's own record says paid — trust Thawani.
        $response = $this->postJson('/api/payments/thawani/verify', [
            'sessionId' => 'sess_real_paid',
            'status' => 'failed',
        ]);

        $response->assertOk();
        $this->assertSame('paid', $booking->fresh()->payment_status);
    }

    public function test_verify_falls_back_to_client_status_when_thawani_session_is_unreachable(): void
    {
        // No fake registered for the session-retrieval URL -> Http::fake() with no
        // matching rule returns an empty stubbed 200, simulating an inconclusive/
        // unreachable session lookup (e.g. a locally-generated fallback session ID).
        Http::fake();

        $bookingPaid = $this->makeBooking('sess_fallback_paid');
        $this->postJson('/api/payments/thawani/verify', [
            'sessionId' => 'sess_fallback_paid',
            'status' => 'paid',
        ])->assertOk();
        $this->assertSame('paid', $bookingPaid->fresh()->payment_status);

        $bookingFailed = $this->makeBooking('sess_fallback_failed');
        $this->postJson('/api/payments/thawani/verify', [
            'sessionId' => 'sess_fallback_failed',
            'status' => 'failed',
        ])->assertOk();
        $bookingFailed->refresh();
        $this->assertSame('failed', $bookingFailed->payment_status);
        $this->assertSame('cancelled', $bookingFailed->booking_status);
    }
}
