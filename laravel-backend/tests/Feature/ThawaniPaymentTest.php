<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\BookingService;
use Carbon\Carbon;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ThawaniPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected const SESSION_ID = 'checkout_TESTSESSION123';
    protected const WEBHOOK_SECRET = 'test_webhook_secret_for_phpunit';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2030-06-10 08:00:00'));
        $this->seed(DatabaseSeeder::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    protected function bookingPayload(string $method = 'thawani', array $overrides = []): array
    {
        $date = now()->addDays(3)->toDateString();

        return array_merge([
            'customerPhone' => '95550001',
            'customerName' => 'Payment Tester',
            'paymentMethod' => $method,
            'cartItems' => [
                ['date' => $date, 'time' => '10:00', 'endTime' => '11:00', 'quantity' => 1],
                ['date' => $date, 'time' => '11:00', 'endTime' => '12:00', 'quantity' => 1],
            ],
        ], $overrides);
    }

    /** Fake a successful session creation followed by a given payment_status. */
    protected function fakeThawani(string $paymentStatus = 'unpaid', string $sessionId = self::SESSION_ID): void
    {
        Http::fake([
            '*/checkout/session' => Http::response([
                'success' => true,
                'data' => ['session_id' => $sessionId, 'payment_status' => 'unpaid', 'invoice' => '123456'],
            ], 200),
            "*/checkout/session/{$sessionId}" => Http::response([
                'success' => true,
                'data' => ['session_id' => $sessionId, 'payment_status' => $paymentStatus, 'invoice' => '123456'],
            ], 200),
        ]);
    }

    protected function createOnlineBookingWithSession(string $paymentStatus = 'unpaid'): Booking
    {
        $this->fakeThawani($paymentStatus);

        $booking = Booking::find(
            $this->postJson('/api/bookings', $this->bookingPayload('thawani'))->json('booking.id')
        );

        $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id])->assertOk();

        return $booking->fresh();
    }

    protected function webhookHeaders(array $payload): array
    {
        $timestamp = (string) time();

        return [
            'thawani-timestamp' => $timestamp,
            'thawani-signature' => hash_hmac('sha256', json_encode($payload).'-'.$timestamp, self::WEBHOOK_SECRET),
        ];
    }

    // ── Pay on arrival ───────────────────────────────────────────────────────

    public function test_pay_on_arrival_confirms_the_booking_immediately(): void
    {
        $response = $this->postJson('/api/bookings', $this->bookingPayload('arrival'));

        $response->assertCreated()
            ->assertJsonPath('booking.bookingStatus', 'confirmed')
            ->assertJsonPath('booking.paymentStatus', 'pending')
            ->assertJsonPath('booking.paymentMethod', 'arrival');

        $payment = Payment::firstWhere('booking_id', $response->json('booking.id'));
        $this->assertSame('arrival', $payment->method);
        $this->assertSame('pending', $payment->status);
        $this->assertSame('OMR', $payment->currency);
    }

    // ── Session creation ─────────────────────────────────────────────────────

    public function test_online_booking_starts_pending_payment_and_stores_the_session(): void
    {
        $booking = $this->createOnlineBookingWithSession();

        $this->assertSame('pending_payment', $booking->booking_status);
        $this->assertSame('pending', $booking->payment_status);

        $payment = $booking->payments()->first();
        $this->assertSame(self::SESSION_ID, $payment->provider_session_id);
        $this->assertSame('thawani', $payment->provider);
        $this->assertSame('123456', $payment->provider_transaction_id);
    }

    public function test_create_session_response_exposes_no_provider_internals(): void
    {
        $this->fakeThawani();
        $booking = Booking::find($this->postJson('/api/bookings', $this->bookingPayload('thawani'))->json('booking.id'));

        $response = $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id]);

        $response->assertOk()->assertJsonStructure(['sessionId', 'paymentUrl']);
        $this->assertArrayNotHasKey('rawApiResponse', $response->json());
        $this->assertArrayNotHasKey('thawaniPayloadSample', $response->json());
    }

    public function test_gateway_failure_is_reported_without_leaking_details_and_creates_no_fake_session(): void
    {
        Http::fake(['*/checkout/session' => Http::response(['description' => 'invalid api key'], 401)]);

        $booking = Booking::find($this->postJson('/api/bookings', $this->bookingPayload('thawani'))->json('booking.id'));

        $response = $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id]);

        $response->assertStatus(502);
        $this->assertStringNotContainsString('invalid api key', $response->getContent());
        $this->assertStringNotContainsString('401', $response->json('error'));
        // No fabricated session id may be persisted.
        $this->assertNull($booking->fresh()->payments()->first()->provider_session_id);
    }

    // ── Idempotency ──────────────────────────────────────────────────────────

    public function test_pressing_confirm_and_pay_twice_reuses_one_session(): void
    {
        $this->fakeThawani();
        $booking = Booking::find($this->postJson('/api/bookings', $this->bookingPayload('thawani'))->json('booking.id'));

        $first = $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id]);
        $second = $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id]);

        $first->assertOk();
        $second->assertOk();
        $this->assertSame($first->json('sessionId'), $second->json('sessionId'));
        $this->assertSame(1, $booking->payments()->count(), 'A second attempt must not orphan another payment row.');
        $this->assertSame(1, Booking::where('customer_phone', '95550001')->count());
    }

    // ── Terminal states ──────────────────────────────────────────────────────

    public function test_successful_payment_confirms_booking(): void
    {
        $booking = $this->createOnlineBookingWithSession('paid');

        $this->getJson('/api/payments/thawani/result?reference='.$booking->reference_code)
            ->assertOk()
            ->assertJsonPath('paymentStatus', 'paid')
            ->assertJsonPath('bookingStatus', 'confirmed');

        $booking->refresh();
        $this->assertSame('paid', $booking->payment_status);
        $this->assertSame('confirmed', $booking->booking_status);
        $this->assertSame('paid', $booking->payments()->first()->status);
    }

    public function test_cancelled_payment_does_not_confirm_the_booking(): void
    {
        $booking = $this->createOnlineBookingWithSession('cancelled');

        $this->getJson('/api/payments/thawani/result?reference='.$booking->reference_code)
            ->assertOk()
            ->assertJsonPath('paymentStatus', 'cancelled');

        $booking->refresh();
        $this->assertSame('cancelled', $booking->payment_status);
        $this->assertSame('cancelled', $booking->booking_status);
        $this->assertNotSame('confirmed', $booking->booking_status);
    }

    public function test_expired_session_does_not_confirm_the_booking(): void
    {
        $booking = $this->createOnlineBookingWithSession('expired');

        $this->getJson('/api/payments/thawani/result?reference='.$booking->reference_code)
            ->assertOk()
            ->assertJsonPath('paymentStatus', 'expired');

        $booking->refresh();
        $this->assertSame('expired', $booking->payment_status);
        $this->assertSame('cancelled', $booking->booking_status);
    }

    /**
     * The regression this whole rework hinges on: "unpaid" is the state every
     * session starts in. Checking status before the customer has paid must not
     * cancel their booking.
     */
    public function test_unpaid_session_leaves_the_booking_pending_and_does_not_cancel_it(): void
    {
        $booking = $this->createOnlineBookingWithSession('unpaid');

        $this->getJson('/api/payments/thawani/result?reference='.$booking->reference_code)
            ->assertOk()
            ->assertJsonPath('paymentStatus', 'pending')
            ->assertJsonPath('bookingStatus', 'pending_payment');

        $booking->refresh();
        $this->assertSame('pending', $booking->payment_status);
        $this->assertSame('pending_payment', $booking->booking_status);
    }

    public function test_unreachable_gateway_during_verification_leaves_booking_pending(): void
    {
        $booking = $this->createOnlineBookingWithSession();

        // Lookup now fails — an unknown answer must not be read as failure.
        Http::fake(['*/checkout/session/*' => Http::response([], 500)]);

        $this->getJson('/api/payments/thawani/result?reference='.$booking->reference_code)->assertOk();

        $booking->refresh();
        $this->assertSame('pending_payment', $booking->booking_status);
        $this->assertSame('pending', $booking->payment_status);
    }

    // ── Webhooks ─────────────────────────────────────────────────────────────

    public function test_webhook_with_invalid_signature_is_rejected(): void
    {
        $booking = $this->createOnlineBookingWithSession('paid');

        $payload = ['event_type' => 'payment.succeeded', 'data' => ['session_id' => self::SESSION_ID]];

        $this->postJson('/api/webhooks/thawani', $payload, [
            'thawani-timestamp' => (string) time(),
            'thawani-signature' => 'wrong',
        ])->assertStatus(401);

        $this->assertSame('pending_payment', $booking->fresh()->booking_status);
    }

    public function test_webhook_settles_payment_and_is_idempotent_when_replayed(): void
    {
        $booking = $this->createOnlineBookingWithSession('paid');

        $payload = ['event_type' => 'payment.succeeded', 'data' => ['session_id' => self::SESSION_ID]];
        $headers = $this->webhookHeaders($payload);

        $this->postJson('/api/webhooks/thawani', $payload, $headers)->assertOk();

        $booking->refresh();
        $this->assertSame('paid', $booking->payment_status);
        $this->assertSame('confirmed', $booking->booking_status);
        $settledAt = $booking->payments()->first()->updated_at;

        // Replay the exact same delivery.
        $this->postJson('/api/webhooks/thawani', $payload, $this->webhookHeaders($payload))->assertOk();

        $booking->refresh();
        $this->assertSame(1, $booking->payments()->count(), 'Replay must not create a second payment.');
        $this->assertSame(1, Booking::where('reference_code', $booking->reference_code)->count());
        $this->assertSame('paid', $booking->payment_status);
        $this->assertEquals($settledAt, $booking->payments()->first()->updated_at, 'Settled payment must not be rewritten.');
    }

    public function test_webhook_payload_claiming_paid_cannot_override_the_real_status(): void
    {
        // Thawani's API still says unpaid, but the webhook body claims success.
        $booking = $this->createOnlineBookingWithSession('unpaid');

        $payload = [
            'event_type' => 'payment.succeeded',
            'data' => ['session_id' => self::SESSION_ID, 'payment_status' => 'paid'],
        ];

        $this->postJson('/api/webhooks/thawani', $payload, $this->webhookHeaders($payload))->assertOk();

        $booking->refresh();
        $this->assertSame('pending', $booking->payment_status, 'The webhook body must never be the source of truth.');
        $this->assertSame('pending_payment', $booking->booking_status);
    }

    public function test_webhook_for_unknown_session_is_ignored(): void
    {
        $payload = ['event_type' => 'payment.succeeded', 'data' => ['session_id' => 'checkout_NOTOURS']];

        $this->postJson('/api/webhooks/thawani', $payload, $this->webhookHeaders($payload))
            ->assertOk()
            ->assertJsonPath('status', 'ignored');
    }

    // ── Money integrity ──────────────────────────────────────────────────────

    public function test_client_supplied_total_is_ignored_in_favour_of_server_pricing(): void
    {
        $this->fakeThawani();

        // Two hours = 8 OMR/hr tier = 16.00. The client claims it owes 1.00.
        $payload = $this->bookingPayload('thawani');
        $payload['total'] = 1;
        $payload['totalAmount'] = 1;

        $booking = Booking::find($this->postJson('/api/bookings', $payload)->json('booking.id'));

        $this->assertSame(16.0, (float) $booking->total_amount);

        $this->postJson('/api/payments/thawani/create-session', [
            'bookingId' => $booking->id,
            'totalAmount' => 1, // ignored — not even read
        ])->assertOk();

        // The amount sent to Thawani is derived from the booking, in baisa.
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/checkout/session')
                && $request->method() === 'POST'
                && ($request->data()['products'][0]['unit_amount'] ?? null) === 16000;
        });

        $this->assertSame(16.0, (float) $booking->payments()->first()->amount);
    }

    public function test_customer_facing_responses_never_expose_the_assigned_court(): void
    {
        $this->fakeThawani();
        $response = $this->postJson('/api/bookings', $this->bookingPayload('arrival'));

        $response->assertCreated();
        $body = $response->getContent();

        $this->assertStringNotContainsString('courtName', $body);
        $this->assertStringNotContainsString('courtId', $body);
        // But the slot times the customer needs are still there.
        $this->assertArrayHasKey('slotTime', $response->json('booking.assignedSlots.0'));

        // Admin, by contrast, does get the court.
        $adminBody = $this->getJson('/api/admin/bookings', ['X-Admin-Key' => config('services.admin.api_key')])
            ->assertOk()
            ->getContent();
        $this->assertStringContainsString('courtName', $adminBody);
    }

    // ── Concurrency ──────────────────────────────────────────────────────────

    public function test_only_one_booking_can_take_the_last_remaining_court(): void
    {
        $date = now()->addDays(4)->toDateString();
        $service = app(BookingService::class);

        // Soak up all 8 courts at 09:00 in a single booking.
        $service->createBooking([
            'customer_phone' => '95550002',
            'payment_method' => 'arrival',
            'cart_items' => [['date' => $date, 'time' => '09:00', 'end_time' => '10:00', 'quantity' => 8]],
        ]);

        // A ninth request for the same hour has nothing left to allocate.
        $response = $this->postJson('/api/bookings', [
            'customerPhone' => '95550003',
            'paymentMethod' => 'arrival',
            'cartItems' => [['date' => $date, 'time' => '09:00', 'endTime' => '10:00', 'quantity' => 1]],
        ]);

        $response->assertStatus(409);
        $this->assertSame(1, Booking::whereHas('items', fn ($q) => $q->where('booking_date', $date)->where('start_time', '09:00:00'))->count());
    }
}
