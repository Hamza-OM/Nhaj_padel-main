<?php

namespace Tests\Feature;

use App\Services\BookingService;
use Carbon\Carbon;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingLookupTest extends TestCase
{
    use RefreshDatabase;

    protected BookingService $bookingService;

    protected function setUp(): void
    {
        parent::setUp();

        // Freeze the clock at a mid-morning hour so every slot these tests derive
        // from "now" lands inside the courts' 07:00-23:00 operating window,
        // regardless of what time of day the suite actually runs.
        Carbon::setTestNow(Carbon::parse('2030-06-10 08:00:00'));

        $this->seed(DatabaseSeeder::class);
        $this->bookingService = app(BookingService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * Creates a booking whose first slot starts $hoursFromNow from now.
     */
    protected function makeBooking(int $hoursFromNow, string $phone = '99887766'): \App\Models\Booking
    {
        $start = now()->addHours($hoursFromNow);

        return $this->bookingService->createBooking([
            'customer_phone' => $phone,
            'customer_name' => 'Lookup Tester',
            'payment_method' => 'arrival',
            'cart_items' => [[
                'date' => $start->toDateString(),
                'time' => $start->format('H:00'),
                'end_time' => $start->copy()->addHour()->format('H:00'),
                'quantity' => 1,
            ]],
        ]);
    }

    public function test_lookup_returns_the_booking_when_reference_and_phone_match(): void
    {
        $booking = $this->makeBooking(48);

        $response = $this->getJson('/api/bookings/lookup?reference='.$booking->reference_code.'&phone=99887766');

        $response->assertOk()
            ->assertJsonPath('booking.referenceCode', $booking->reference_code)
            ->assertJsonPath('cancellationWindowHours', BookingService::CANCELLATION_WINDOW_HOURS);
    }

    public function test_lookup_is_case_insensitive_on_the_reference_code(): void
    {
        $booking = $this->makeBooking(48);

        $this->getJson('/api/bookings/lookup?reference='.strtolower($booking->reference_code).'&phone=99887766')
            ->assertOk()
            ->assertJsonPath('booking.referenceCode', $booking->reference_code);
    }

    public function test_lookup_fails_when_the_phone_does_not_match_the_reference(): void
    {
        $booking = $this->makeBooking(48, '99887766');

        $this->getJson('/api/bookings/lookup?reference='.$booking->reference_code.'&phone=11112222')
            ->assertStatus(404);
    }

    public function test_lookup_requires_both_reference_and_phone(): void
    {
        $this->getJson('/api/bookings/lookup?reference=PAD-ABCDE')->assertStatus(422);
        $this->getJson('/api/bookings/lookup?phone=99887766')->assertStatus(422);
    }

    public function test_customer_can_cancel_a_booking_outside_the_cancellation_window(): void
    {
        $booking = $this->makeBooking(48);

        $response = $this->postJson('/api/bookings/cancel', [
            'reference' => $booking->reference_code,
            'phone' => '99887766',
        ]);

        $response->assertOk()->assertJsonPath('booking.bookingStatus', 'cancelled');
        $this->assertSame('cancelled', $booking->fresh()->booking_status);
    }

    public function test_customer_cannot_cancel_inside_the_cancellation_window(): void
    {
        // Starts in 3 hours — inside the 6-hour policy window.
        $booking = $this->makeBooking(3);

        $response = $this->postJson('/api/bookings/cancel', [
            'reference' => $booking->reference_code,
            'phone' => '99887766',
        ]);

        $response->assertStatus(422);
        $this->assertSame('confirmed', $booking->fresh()->booking_status);
    }

    public function test_cancelling_an_already_cancelled_booking_is_rejected(): void
    {
        $booking = $this->makeBooking(48);

        $payload = ['reference' => $booking->reference_code, 'phone' => '99887766'];

        $this->postJson('/api/bookings/cancel', $payload)->assertOk();
        $this->postJson('/api/bookings/cancel', $payload)->assertStatus(422);
    }

    public function test_cancelling_with_a_mismatched_phone_is_rejected(): void
    {
        $booking = $this->makeBooking(48, '99887766');

        $this->postJson('/api/bookings/cancel', [
            'reference' => $booking->reference_code,
            'phone' => '11112222',
        ])->assertStatus(404);

        $this->assertSame('confirmed', $booking->fresh()->booking_status);
    }

    public function test_cancelled_slots_are_released_back_into_the_availability_pool(): void
    {
        $start = now()->addDays(3)->setTime(10, 0);
        $date = $start->toDateString();

        $totalCourts = \App\Models\Court::where('is_active', true)->count();

        $booking = $this->bookingService->createBooking([
            'customer_phone' => '99887766',
            'payment_method' => 'arrival',
            'cart_items' => [[
                'date' => $date,
                'time' => '10:00',
                'end_time' => '11:00',
                'quantity' => 1,
            ]],
        ]);

        $slots = $this->bookingService->getPooledAvailability($date);
        $slot10 = collect($slots['slots'])->firstWhere('time', '10:00');
        $this->assertSame($totalCourts - 1, $slot10['available_courts_count']);

        $this->postJson('/api/bookings/cancel', [
            'reference' => $booking->reference_code,
            'phone' => '99887766',
        ])->assertOk();

        $after = $this->bookingService->getPooledAvailability($date);
        $slot10After = collect($after['slots'])->firstWhere('time', '10:00');
        $this->assertSame($totalCourts, $slot10After['available_courts_count'], 'Cancelling should free the court again.');
    }
}
