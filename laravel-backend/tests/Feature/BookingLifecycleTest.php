<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Court;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A confirmed booking becomes 'completed' when its last booked hour ends —
 * a value that is derived on read, never stored.
 *
 * The rule used to compare dates only, which was wrong twice: it ignored the
 * clock (a session ending at 15:00 stayed "confirmed" until midnight), and it
 * read booking_date, which holds the booking's *earliest* date, so a booking
 * spanning two days looked finished while later slots were still to come.
 *
 * Completion says nothing about money. Pay-on-arrival stays unpaid until a
 * member of staff settles it.
 */
class BookingLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2030-06-10 12:00:00'));
        $this->seed(DatabaseSeeder::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * Writes a booking directly so each test can place its hours exactly where
     * it needs them, including in the past — which BookingService refuses.
     *
     * @param  array<int, array{0:string, 1:string, 2:string}>  $slots  [date, start, end]
     */
    protected function makeBooking(array $slots, string $method = 'arrival', string $paymentStatus = 'pending', string $status = 'confirmed'): Booking
    {
        $booking = Booking::create([
            'reference_code' => 'PAD-'.strtoupper(substr(md5(uniqid()), 0, 5)),
            'customer_phone' => '99887766',
            'customer_name' => 'Lifecycle Tester',
            'booking_date' => $slots[0][0],
            'total_duration_hours' => count($slots),
            'subtotal_amount' => 10 * count($slots),
            'discount_amount' => 0,
            'total_amount' => 10 * count($slots),
            'currency' => 'OMR',
            'payment_method' => $method,
            'payment_status' => $paymentStatus,
            'booking_status' => $status,
        ]);

        Payment::create([
            'booking_id' => $booking->id,
            'method' => $method,
            'status' => $paymentStatus === 'paid' ? 'paid' : 'pending',
            'amount' => $booking->total_amount,
            'currency' => 'OMR',
        ]);

        $courtId = Court::first()->id;
        foreach ($slots as [$date, $start, $end]) {
            BookingItem::create([
                'booking_id' => $booking->id,
                'court_id' => $courtId,
                'booking_date' => $date,
                'start_time' => $start,
                'end_time' => $end,
                'slot_price' => 10,
            ]);
        }

        return $booking->load('items');
    }

    protected function statusSeenByAdmin(Booking $booking): string
    {
        Sanctum::actingAs(User::factory()->create());

        $row = collect($this->getJson('/api/admin/bookings')->assertOk()->json())
            ->firstWhere('referenceCode', $booking->reference_code);

        return $row['bookingStatus'];
    }

    // ── A single hour ────────────────────────────────────────────────────────

    public function test_a_booking_later_today_is_still_confirmed(): void
    {
        $booking = $this->makeBooking([['2030-06-10', '18:00:00', '19:00:00']]);

        $this->assertSame('confirmed', $this->statusSeenByAdmin($booking));
    }

    public function test_a_booking_in_progress_right_now_is_still_confirmed(): void
    {
        // 12:00 now; the hour runs 11:30–12:30.
        $booking = $this->makeBooking([['2030-06-10', '11:30:00', '12:30:00']]);

        $this->assertSame('confirmed', $this->statusSeenByAdmin($booking));
    }

    public function test_a_booking_that_ended_earlier_today_is_completed(): void
    {
        // This is the reported bug: date-only comparison left it "confirmed"
        // until midnight, hours after the court was vacated.
        $booking = $this->makeBooking([['2030-06-10', '09:00:00', '10:00:00']]);

        $this->assertSame('completed', $this->statusSeenByAdmin($booking));
    }

    // ── Multi-hour ───────────────────────────────────────────────────────────

    public function test_a_two_hour_booking_stays_confirmed_after_its_first_hour_ends(): void
    {
        // 14:00–16:00 seen at 15:00 must NOT be completed: the court is still
        // in use for another hour.
        Carbon::setTestNow(Carbon::parse('2030-06-10 15:00:00'));

        $booking = $this->makeBooking([
            ['2030-06-10', '14:00:00', '15:00:00'],
            ['2030-06-10', '15:00:00', '16:00:00'],
        ]);

        $this->assertSame('confirmed', $this->statusSeenByAdmin($booking));
    }

    public function test_a_two_hour_booking_completes_once_its_final_hour_ends(): void
    {
        Carbon::setTestNow(Carbon::parse('2030-06-10 16:01:00'));

        $booking = $this->makeBooking([
            ['2030-06-10', '14:00:00', '15:00:00'],
            ['2030-06-10', '15:00:00', '16:00:00'],
        ]);

        $this->assertSame('completed', $this->statusSeenByAdmin($booking));
    }

    public function test_a_booking_spanning_two_dates_stays_confirmed_until_the_later_one_ends(): void
    {
        // booking_date is the earliest date, so the old rule marked this
        // completed on the 11th while the 15th was still to come.
        $booking = $this->makeBooking([
            ['2030-06-09', '18:00:00', '19:00:00'],
            ['2030-06-15', '18:00:00', '19:00:00'],
        ]);

        $this->assertSame('confirmed', $this->statusSeenByAdmin($booking));
    }

    // ── Payment stays a separate concern ─────────────────────────────────────

    public function test_completion_never_marks_a_pay_on_arrival_booking_as_paid(): void
    {
        $booking = $this->makeBooking([['2030-06-10', '09:00:00', '10:00:00']]);

        $this->assertSame('completed', $this->statusSeenByAdmin($booking));

        $booking->refresh();
        $this->assertSame('pending', $booking->payment_status);
        $this->assertSame('pending', $booking->payments()->latest()->first()->status);
        // Nothing is persisted — 'completed' exists only in the response.
        $this->assertSame('confirmed', $booking->booking_status);
    }

    public function test_a_paid_online_booking_also_completes_and_keeps_its_paid_status(): void
    {
        $booking = $this->makeBooking([['2030-06-10', '09:00:00', '10:00:00']], 'thawani', 'paid');

        $this->assertSame('completed', $this->statusSeenByAdmin($booking));
        $this->assertSame('paid', $booking->fresh()->payment_status);
    }

    // ── Other statuses are untouched ─────────────────────────────────────────

    public function test_a_cancelled_booking_never_becomes_completed(): void
    {
        $booking = $this->makeBooking([['2030-06-09', '09:00:00', '10:00:00']], 'arrival', 'cancelled', 'cancelled');

        $this->assertSame('cancelled', $this->statusSeenByAdmin($booking));
    }

    public function test_an_abandoned_checkout_stays_awaiting_payment_after_its_time_passes(): void
    {
        // It was never confirmed, so it cannot have been completed.
        $booking = $this->makeBooking([['2030-06-09', '09:00:00', '10:00:00']], 'thawani', 'pending', 'pending_payment');

        $this->assertSame('pending_payment', $this->statusSeenByAdmin($booking));
    }

    // ── The admin filter agrees with the badges ──────────────────────────────

    public function test_the_completed_filter_returns_exactly_the_finished_bookings(): void
    {
        $finished = $this->makeBooking([['2030-06-10', '09:00:00', '10:00:00']]);
        $upcoming = $this->makeBooking([['2030-06-10', '18:00:00', '19:00:00']]);
        $midway = $this->makeBooking([
            ['2030-06-10', '11:00:00', '12:00:00'],
            ['2030-06-10', '12:00:00', '13:00:00'],
        ]);

        Sanctum::actingAs(User::factory()->create());
        $refs = collect($this->getJson('/api/admin/bookings?status=completed')->assertOk()->json())
            ->pluck('referenceCode');

        $this->assertContains($finished->reference_code, $refs);
        $this->assertNotContains($upcoming->reference_code, $refs);
        $this->assertNotContains($midway->reference_code, $refs, 'A session still in progress is not completed.');
    }

    public function test_the_confirmed_filter_excludes_finished_bookings(): void
    {
        $finished = $this->makeBooking([['2030-06-10', '09:00:00', '10:00:00']]);
        $upcoming = $this->makeBooking([['2030-06-10', '18:00:00', '19:00:00']]);

        Sanctum::actingAs(User::factory()->create());
        $refs = collect($this->getJson('/api/admin/bookings?status=confirmed')->assertOk()->json())
            ->pluck('referenceCode');

        $this->assertContains($upcoming->reference_code, $refs);
        $this->assertNotContains($finished->reference_code, $refs);
    }
}
