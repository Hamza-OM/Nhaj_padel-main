<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\User;
use App\Services\BookingService;
use Carbon\Carbon;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Online bookings settle themselves — Thawani reports whether the money
 * arrived. Cash taken at reception has no such signal, so before this existed
 * a pay-on-arrival booking stayed 'pending' forever: revenue never counted a
 * riyal taken in person, and every past session accumulated as "expected"
 * whether the customer paid or never turned up.
 */
class AdminSettleBookingTest extends TestCase
{
    use RefreshDatabase;

    protected BookingService $bookingService;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2030-06-10 08:00:00'));
        $this->seed(DatabaseSeeder::class);
        $this->bookingService = app(BookingService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    protected function arrivalBooking(): Booking
    {
        $start = now()->addDays(2);

        return $this->bookingService->createBooking([
            'customer_phone' => '99887766',
            'customer_name' => 'Counter Payer',
            'payment_method' => 'arrival',
            'cart_items' => [[
                'date' => $start->toDateString(),
                'time' => $start->format('H:00'),
                'end_time' => $start->copy()->addHour()->format('H:00'),
                'quantity' => 1,
            ]],
        ]);
    }

    public function test_marking_a_booking_paid_records_the_money_on_both_records(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $booking = $this->arrivalBooking();

        $this->assertSame('pending', $booking->payment_status);

        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'paid'])
            ->assertOk()
            ->assertJsonPath('booking.paymentStatus', 'paid');

        $this->assertSame('paid', $booking->fresh()->payment_status);
        $this->assertSame('paid', $booking->payments()->latest()->first()->status);
    }

    public function test_a_no_show_is_recorded_without_counting_as_revenue(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $booking = $this->arrivalBooking();

        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'no_show'])
            ->assertOk();

        $booking->refresh();
        $this->assertSame('cancelled', $booking->payment_status);
        $this->assertNotSame('paid', $booking->payment_status);
        // The booking itself still happened on the books — only the money changed.
        $this->assertSame('confirmed', $booking->booking_status);
    }

    public function test_online_bookings_cannot_be_settled_by_hand(): void
    {
        // Otherwise staff could mark an unpaid Thawani booking as paid and
        // bypass the gateway entirely.
        Sanctum::actingAs(User::factory()->create());

        Http::fake(['*/checkout/session' => Http::response([
            'success' => true,
            'data' => ['session_id' => 'checkout_X', 'payment_status' => 'unpaid'],
        ], 200)]);

        $start = now()->addDays(2);
        $booking = $this->bookingService->createBooking([
            'customer_phone' => '99887755',
            'payment_method' => 'thawani',
            'cart_items' => [[
                'date' => $start->toDateString(),
                'time' => $start->format('H:00'),
                'end_time' => $start->copy()->addHour()->format('H:00'),
                'quantity' => 1,
            ]],
        ]);

        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'paid'])
            ->assertStatus(422);

        $this->assertNotSame('paid', $booking->fresh()->payment_status);
    }

    public function test_a_booking_cannot_be_settled_twice(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $booking = $this->arrivalBooking();

        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'paid'])->assertOk();
        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'no_show'])->assertStatus(422);

        $this->assertSame('paid', $booking->fresh()->payment_status);
    }

    public function test_a_cancelled_booking_cannot_be_settled(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $booking = $this->arrivalBooking();
        $booking->update(['booking_status' => 'cancelled']);

        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'paid'])
            ->assertStatus(422);

        $this->assertSame('pending', $booking->fresh()->payment_status);
    }

    public function test_settling_requires_a_valid_outcome(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $booking = $this->arrivalBooking();

        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'maybe'])
            ->assertStatus(422);
    }

    public function test_settling_requires_authentication(): void
    {
        $booking = $this->arrivalBooking();

        $this->postJson("/api/admin/bookings/{$booking->id}/settle", ['outcome' => 'paid'])
            ->assertStatus(401);

        $this->assertSame('pending', $booking->fresh()->payment_status);
    }
}
