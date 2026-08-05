<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Court;
use App\Models\CourtClosure;
use App\Services\BookingService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingServiceTest extends TestCase
{
    use RefreshDatabase;

    protected BookingService $bookingService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->bookingService = app(BookingService::class);
    }

    protected function bookingData(array $cartItems, array $overrides = []): array
    {
        return array_merge([
            'customer_phone' => '99999999',
            'customer_name' => 'Test Customer',
            'payment_method' => 'arrival',
            'cart_items' => $cartItems,
        ], $overrides);
    }

    public function test_contiguous_multi_hour_booking_stays_on_the_same_court(): void
    {
        $date = now()->addDays(2)->toDateString();

        $booking = $this->bookingService->createBooking($this->bookingData([
            ['date' => $date, 'time' => '10:00', 'end_time' => '11:00', 'quantity' => 1],
            ['date' => $date, 'time' => '11:00', 'end_time' => '12:00', 'quantity' => 1],
            ['date' => $date, 'time' => '12:00', 'end_time' => '13:00', 'quantity' => 1],
        ]));

        $courtIds = $booking->items->pluck('court_id')->unique();

        $this->assertCount(3, $booking->items);
        $this->assertCount(1, $courtIds, 'All three contiguous hours should be assigned to the same court.');
    }

    public function test_booking_a_past_time_slot_is_rejected(): void
    {
        $this->expectException(\Exception::class);

        $yesterday = now()->subDay()->toDateString();

        $this->bookingService->createBooking($this->bookingData([
            ['date' => $yesterday, 'time' => '10:00', 'end_time' => '11:00', 'quantity' => 1],
        ]));
    }

    public function test_booking_fails_when_not_enough_courts_are_eligible_for_the_full_session(): void
    {
        $this->expectException(\Exception::class);

        $date = now()->addDays(2)->toDateString();

        // Only 8 courts are seeded — requesting 9 for one hour can never be satisfied.
        $this->bookingService->createBooking($this->bookingData([
            ['date' => $date, 'time' => '10:00', 'end_time' => '11:00', 'quantity' => 9],
        ]));
    }

    public function test_pooled_availability_marks_past_slots_unavailable(): void
    {
        $yesterday = now()->subDay()->toDateString();

        $result = $this->bookingService->getPooledAvailability($yesterday);

        foreach ($result['slots'] as $slot) {
            $this->assertFalse($slot['is_available']);
            $this->assertSame('Time slot has passed', $slot['reason']);
        }
    }

    public function test_pooled_availability_reflects_closures_and_existing_bookings(): void
    {
        $date = now()->addDays(2)->toDateString();
        $totalCourts = Court::where('is_active', true)->count();

        // Baseline: an untouched future hour is fully available.
        $baseline = $this->bookingService->getPooledAvailability($date);
        $slot10 = collect($baseline['slots'])->firstWhere('time', '10:00');
        $this->assertSame($totalCourts, $slot10['available_courts_count']);
        $this->assertTrue($slot10['is_available']);

        // Book one court at 10:00 — availability for that slot should drop by exactly one.
        $court = Court::first();
        $booking = Booking::create([
            'reference_code' => 'PAD-TEST1',
            'customer_phone' => '99999999',
            'booking_date' => $date,
            'total_duration_hours' => 1,
            'subtotal_amount' => 10,
            'total_amount' => 10,
            'payment_method' => 'arrival',
            'payment_status' => 'pending',
            'booking_status' => 'confirmed',
        ]);
        BookingItem::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => $date,
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
            'slot_price' => 10,
        ]);

        $afterBooking = $this->bookingService->getPooledAvailability($date);
        $slot10After = collect($afterBooking['slots'])->firstWhere('time', '10:00');
        $this->assertSame($totalCourts - 1, $slot10After['available_courts_count']);

        // A different hour on the same date is unaffected.
        $slot14After = collect($afterBooking['slots'])->firstWhere('time', '14:00');
        $this->assertSame($totalCourts, $slot14After['available_courts_count']);

        // Close every court for the date — the 14:00 slot should now show zero availability.
        CourtClosure::create([
            'court_id' => null,
            'start_date' => $date,
            'end_date' => $date,
            'reason' => 'Maintenance',
        ]);

        $afterClosure = $this->bookingService->getPooledAvailability($date);
        $slot14Closed = collect($afterClosure['slots'])->firstWhere('time', '14:00');
        $this->assertSame(0, $slot14Closed['available_courts_count']);
        $this->assertSame('Closed for maintenance', $slot14Closed['reason']);
    }
}
