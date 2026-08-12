<?php

namespace Tests\Feature;

use App\Mail\BookingConfirmed;
use App\Models\Booking;
use Carbon\Carbon;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * The confirmation email must track the booking's *real* state, not the
 * customer's intent. A Thawani booking sits in pending_payment until the
 * gateway says otherwise, and emailing "confirmed" before that point would
 * be telling the customer something untrue.
 */
class BookingNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected const SESSION_ID = 'checkout_MAILTEST123';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2030-06-10 08:00:00'));
        $this->seed(DatabaseSeeder::class);
        Mail::fake();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    protected function payload(string $method, array $overrides = []): array
    {
        $date = now()->addDays(3)->toDateString();

        return array_merge([
            'customerPhone' => '95550111',
            'customerName' => 'Mail Tester',
            'customerEmail' => 'player@example.com',
            'paymentMethod' => $method,
            'cartItems' => [
                ['date' => $date, 'time' => '10:00', 'endTime' => '11:00', 'quantity' => 1],
            ],
        ], $overrides);
    }

    protected function fakeThawani(string $paymentStatus): void
    {
        Http::fake([
            '*/checkout/session' => Http::response([
                'success' => true,
                'data' => ['session_id' => self::SESSION_ID, 'payment_status' => 'unpaid', 'invoice' => '9001'],
            ], 200),
            '*/checkout/session/'.self::SESSION_ID => Http::response([
                'success' => true,
                'data' => ['session_id' => self::SESSION_ID, 'payment_status' => $paymentStatus, 'invoice' => '9001'],
            ], 200),
        ]);
    }

    public function test_pay_on_arrival_booking_emails_the_customer_immediately(): void
    {
        $this->postJson('/api/bookings', $this->payload('arrival'))->assertCreated();

        Mail::assertQueued(BookingConfirmed::class, function ($mail) {
            return $mail->hasTo('player@example.com');
        });
    }

    public function test_unpaid_thawani_booking_does_not_email_the_customer(): void
    {
        $this->fakeThawani('unpaid');

        $booking = Booking::find(
            $this->postJson('/api/bookings', $this->payload('thawani'))->json('booking.id')
        );
        $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id])->assertOk();
        $this->getJson('/api/payments/thawani/result?reference='.$booking->reference_code)->assertOk();

        $this->assertSame('pending_payment', $booking->fresh()->booking_status);
        Mail::assertNotQueued(BookingConfirmed::class);
    }

    public function test_thawani_booking_emails_the_customer_once_payment_settles(): void
    {
        $this->fakeThawani('paid');

        $booking = Booking::find(
            $this->postJson('/api/bookings', $this->payload('thawani'))->json('booking.id')
        );
        $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id])->assertOk();

        Mail::assertNotQueued(BookingConfirmed::class);

        $this->getJson('/api/payments/thawani/result?reference='.$booking->reference_code)->assertOk();

        $this->assertSame('confirmed', $booking->fresh()->booking_status);
        Mail::assertQueued(BookingConfirmed::class, fn ($mail) => $mail->hasTo('player@example.com'));
    }

    public function test_settling_the_same_payment_twice_only_emails_once(): void
    {
        $this->fakeThawani('paid');

        $booking = Booking::find(
            $this->postJson('/api/bookings', $this->payload('thawani'))->json('booking.id')
        );
        $this->postJson('/api/payments/thawani/create-session', ['bookingId' => $booking->id])->assertOk();

        $url = '/api/payments/thawani/result?reference='.$booking->reference_code;
        $this->getJson($url)->assertOk();
        $this->getJson($url)->assertOk();

        Mail::assertQueuedCount(1);
    }

    public function test_booking_without_an_email_address_sends_nothing_and_still_succeeds(): void
    {
        $this->postJson('/api/bookings', $this->payload('arrival', ['customerEmail' => null]))
            ->assertCreated();

        Mail::assertNothingQueued();
    }

    public function test_confirmation_email_never_reveals_the_assigned_court(): void
    {
        // Courts are pooled anonymously everywhere else in the product; the
        // email must not be the one place that leaks the assignment.
        $booking = Booking::find(
            $this->postJson('/api/bookings', $this->payload('arrival'))->json('booking.id')
        );

        $rendered = (new BookingConfirmed($booking))->render();

        $courtName = $booking->items()->with('court')->first()->court->name;
        $this->assertStringNotContainsString($courtName, $rendered);
    }
}
