<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Court;
use App\Models\Payment;
use App\Services\PricingService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Realistic booking history for demos and screenshots.
 *
 * Deliberately NOT called from DatabaseSeeder: a fresh install should come up
 * with courts and pricing only. Run it explicitly when you want a populated
 * dashboard:
 *
 *     php artisan db:seed --class=DemoBookingSeeder
 *
 * Bookings are written directly rather than through BookingService because the
 * service (correctly) refuses to book slots in the past, and a believable
 * dashboard needs history behind it. Court assignment still respects the one
 * rule that matters: a court is never double-booked for the same hour.
 */
class DemoBookingSeeder extends Seeder
{
    private const PLAYERS = [
        ['Ahmed Al-Balushi', '99451203', 'ahmed.balushi@example.com'],
        ['Fatma Al-Hinai', '92330871', 'fatma.hinai@example.com'],
        ['Khalid Al-Rawahi', '97812440', null],
        ['Mariam Al-Zadjali', '95604118', 'mariam.z@example.com'],
        ['Sultan Al-Habsi', '91276503', null],
        ['Noor Al-Kindi', '93845092', 'noor.kindi@example.com'],
        ['Yousuf Al-Maskari', '96130877', null],
        ['Aisha Al-Farsi', '94502316', 'aisha.farsi@example.com'],
        ['Salim Al-Amri', '98761204', null],
        ['Hind Al-Saadi', '92014765', 'hind.saadi@example.com'],
        ['Omar Al-Riyami', '97452038', null],
        ['Layla Al-Busaidi', '95338702', 'layla.b@example.com'],
    ];

    public function run(): void
    {
        $courts = Court::where('is_active', true)->orderBy('id')->get();

        if ($courts->isEmpty()) {
            $this->command?->warn('No active courts — run DatabaseSeeder first.');

            return;
        }

        $pricing = app(PricingService::class);
        $today = Carbon::today();

        // court_id + date + start_time already taken, so the demo data can never
        // contradict the availability the app computes from it.
        $taken = [];
        foreach (BookingItem::all() as $item) {
            $date = $item->booking_date instanceof \DateTimeInterface
                ? $item->booking_date->format('Y-m-d')
                : $item->booking_date;
            $taken[$item->court_id.'|'.$date.'|'.substr($item->start_time, 0, 5)] = true;
        }

        $plan = $this->buildPlan($today);

        DB::transaction(function () use ($plan, $courts, $pricing, &$taken) {
            foreach ($plan as $entry) {
                [$name, $phone, $email] = $entry['player'];

                $court = $courts->first(
                    fn ($c) => ! isset($taken[$c->id.'|'.$entry['date'].'|'.$entry['hours'][0]])
                        && collect($entry['hours'])->every(
                            fn ($h) => ! isset($taken[$c->id.'|'.$entry['date'].'|'.$h])
                        )
                );

                if (! $court) {
                    continue; // Every court busy for that run — skip rather than overbook.
                }

                $duration = count($entry['hours']);
                $price = $pricing->calculatePricing($duration, (float) $court->base_price_per_hour);

                $booking = Booking::create([
                    'reference_code' => 'PAD-'.strtoupper(Str::random(5)),
                    'customer_phone' => $phone,
                    'customer_name' => $name,
                    'customer_email' => $email,
                    'booking_date' => $entry['date'],
                    'total_duration_hours' => $duration,
                    'subtotal_amount' => $price['subtotal'],
                    'discount_amount' => $price['discount_amount'],
                    'total_amount' => $price['final_total'],
                    'currency' => 'OMR',
                    'payment_method' => $entry['method'],
                    'payment_status' => $entry['paymentStatus'],
                    'booking_status' => $entry['bookingStatus'],
                    'created_at' => Carbon::parse($entry['date'])->subDays(2)->setTime(rand(9, 21), rand(0, 59)),
                    'updated_at' => now(),
                ]);

                Payment::create([
                    'booking_id' => $booking->id,
                    'method' => $entry['method'],
                    'status' => $entry['paymentStatus'] === 'paid' ? 'paid' : 'pending',
                    'amount' => $price['final_total'],
                    'currency' => 'OMR',
                    'provider' => $entry['method'] === 'thawani' ? 'thawani' : null,
                    'provider_session_id' => $entry['method'] === 'thawani'
                        ? 'checkout_demo_'.Str::random(12)
                        : null,
                ]);

                foreach ($entry['hours'] as $hour) {
                    BookingItem::create([
                        'booking_id' => $booking->id,
                        'court_id' => $court->id,
                        'booking_date' => $entry['date'],
                        'start_time' => $hour.':00',
                        'end_time' => str_pad((int) substr($hour, 0, 2) + 1, 2, '0', STR_PAD_LEFT).':00:00',
                        'slot_price' => $price['effective_rate_per_hour'],
                    ]);
                    $taken[$court->id.'|'.$entry['date'].'|'.$hour] = true;
                }
            }
        });

        $this->command?->info('Demo bookings seeded.');
    }

    /**
     * Ten bookings — enough to look like a working club, few enough to read at
     * a glance on screen.
     *
     * Past sessions are all settled online, so nothing shows up as an
     * unreconciled backlog. Upcoming days mix paid-online with pay-on-arrival
     * to exercise both revenue buckets, and every booking is confirmed: the
     * cancelled and awaiting-payment states are better demonstrated live than
     * left sitting in the data raising questions.
     */
    private function buildPlan(Carbon $today): array
    {
        $players = self::PLAYERS;

        return [
            // ── Settled history: drives "revenue collected" ────────────────
            ['player' => $players[0], 'date' => $today->copy()->subDays(6)->toDateString(),
                'hours' => ['19:00', '20:00'], 'method' => 'thawani', 'paymentStatus' => 'paid', 'bookingStatus' => 'confirmed'],
            ['player' => $players[1], 'date' => $today->copy()->subDays(4)->toDateString(),
                'hours' => ['18:00'], 'method' => 'thawani', 'paymentStatus' => 'paid', 'bookingStatus' => 'confirmed'],
            ['player' => $players[2], 'date' => $today->copy()->subDays(3)->toDateString(),
                'hours' => ['20:00', '21:00'], 'method' => 'thawani', 'paymentStatus' => 'paid', 'bookingStatus' => 'confirmed'],
            ['player' => $players[3], 'date' => $today->copy()->subDays(1)->toDateString(),
                'hours' => ['17:00'], 'method' => 'thawani', 'paymentStatus' => 'paid', 'bookingStatus' => 'confirmed'],

            // ── Today ─────────────────────────────────────────────────────
            ['player' => $players[4], 'date' => $today->toDateString(),
                'hours' => ['21:00', '22:00'], 'method' => 'thawani', 'paymentStatus' => 'paid', 'bookingStatus' => 'confirmed'],
            ['player' => $players[5], 'date' => $today->toDateString(),
                'hours' => ['22:00'], 'method' => 'arrival', 'paymentStatus' => 'pending', 'bookingStatus' => 'confirmed'],

            // ── Upcoming: the pipeline ────────────────────────────────────
            ['player' => $players[6], 'date' => $today->copy()->addDay()->toDateString(),
                'hours' => ['18:00', '19:00'], 'method' => 'thawani', 'paymentStatus' => 'paid', 'bookingStatus' => 'confirmed'],
            ['player' => $players[7], 'date' => $today->copy()->addDay()->toDateString(),
                'hours' => ['20:00'], 'method' => 'arrival', 'paymentStatus' => 'pending', 'bookingStatus' => 'confirmed'],
            ['player' => $players[8], 'date' => $today->copy()->addDays(2)->toDateString(),
                'hours' => ['19:00'], 'method' => 'thawani', 'paymentStatus' => 'paid', 'bookingStatus' => 'confirmed'],
            ['player' => $players[9], 'date' => $today->copy()->addDays(3)->toDateString(),
                'hours' => ['17:00', '18:00'], 'method' => 'arrival', 'paymentStatus' => 'pending', 'bookingStatus' => 'confirmed'],
        ];
    }
}
