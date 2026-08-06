<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Court;
use App\Models\CourtClosure;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Exception;

class BookingService
{
    /**
     * How far ahead of the first slot a customer may still cancel themselves.
     * Mirrors the cancellation policy quoted in the Club Info FAQ.
     */
    public const CANCELLATION_WINDOW_HOURS = 6;

    protected PricingService $pricingService;

    public function __construct(PricingService $pricingService)
    {
        $this->pricingService = $pricingService;
    }

    /**
     * Requirement #3: Pooled Slot Availability (Anonymous Courts)
     */
    public function getPooledAvailability(string $dateStr): array
    {
        $startHour = 7;
        $endHour = 23;

        $activeCourts = Court::where('is_active', true)->get();
        $totalCourts = $activeCourts->count();

        // Active bookings for this date
        $existingItems = BookingItem::where('booking_date', $dateStr)
            ->whereHas('booking', function ($query) {
                $query->where('booking_status', '!=', 'cancelled');
            })->get();

        // Closures for date
        $closures = CourtClosure::where('start_date', '<=', $dateStr)
            ->where('end_date', '>=', $dateStr)
            ->get();

        $todayStr = now()->format('Y-m-d');
        $currentHour = now()->hour;

        $slots = [];

        for ($hour = $startHour; $hour < $endHour; $hour++) {
            $timeSlot = sprintf('%02d:00:00', $hour);
            $endTimeSlot = sprintf('%02d:00:00', $hour + 1);
            $displayTime = sprintf('%02d:00', $hour);
            $displayEndTime = sprintf('%02d:00', $hour + 1);

            $isPast = ($dateStr < $todayStr) || ($dateStr === $todayStr && $hour <= $currentHour);

            if ($isPast) {
                $slots[] = [
                    'time' => $displayTime,
                    'end_time' => $displayEndTime,
                    'available_courts_count' => 0,
                    'total_active_courts' => $totalCourts,
                    'is_available' => false,
                    'reason' => 'Time slot has passed',
                ];
                continue;
            }

            $availableCount = 0;
            $openCourtsCount = 0;
            $closedCourtsCount = 0;

            foreach ($activeCourts as $court) {
                // Check court operating hours
                $courtOpen = (int) explode(':', $court->opening_time)[0];
                $courtClose = (int) explode(':', $court->closing_time)[0];
                if ($hour < $courtOpen || $hour >= $courtClose) {
                    continue;
                }

                $openCourtsCount++;

                // Check blackout closures
                $isClosed = $closures->contains(function ($c) use ($court) {
                    return $c->court_id === null || $c->court_id == $court->id;
                });
                if ($isClosed) {
                    $closedCourtsCount++;
                    continue;
                }

                // Check existing bookings
                $isBooked = $existingItems->contains(function ($item) use ($timeSlot, $court) {
                    return $item->start_time === $timeSlot && $item->court_id == $court->id;
                });

                if (!$isBooked) {
                    $availableCount++;
                }
            }

            $reason = null;
            if ($availableCount === 0) {
                if ($openCourtsCount === 0) {
                    $reason = 'No courts operating at this hour';
                } elseif ($closedCourtsCount === $openCourtsCount) {
                    $reason = 'Closed for maintenance';
                } elseif ($closedCourtsCount > 0) {
                    $reason = 'Partially closed and fully booked';
                } else {
                    $reason = 'Fully booked';
                }
            }

            $slots[] = [
                'time' => $displayTime,
                'end_time' => $displayEndTime,
                'available_courts_count' => $availableCount,
                'total_active_courts' => $totalCourts,
                'is_available' => $availableCount > 0,
                'reason' => $reason,
            ];
        }

        return [
            'date' => $dateStr,
            'total_active_courts' => $totalCourts,
            'slots' => $slots,
        ];
    }

    /**
     * Requirement #3: Random Court Assignment & Atomic Cart Checkout
     *
     * Courts are assigned per contiguous "session" rather than per hour: a run of
     * consecutive hours on the same date requesting the same number of courts is
     * treated as one continuous play session and kept on the same physical court(s)
     * for its whole duration, instead of re-rolling a (possibly different) court
     * every single hour.
     */
    public function createBooking(array $data): Booking
    {
        return DB::transaction(function () use ($data) {
            $customerPhone = trim($data['customer_phone']);
            $customerName = isset($data['customer_name']) ? trim($data['customer_name']) : null;
            $customerEmail = isset($data['customer_email']) ? trim($data['customer_email']) : null;
            $paymentMethod = $data['payment_method'] ?? 'arrival';
            $cartItems = $data['cart_items'];

            $activeCourts = Court::where('is_active', true)->lockForUpdate()->get();

            $totalDuration = 0;
            foreach ($cartItems as $ci) {
                $totalDuration += ($ci['quantity'] ?? 1);
            }

            // Calculate Tiered Price
            $pricing = $this->pricingService->calculatePricing($totalDuration);

            // Normalize cart items and sort chronologically so consecutive hours can be grouped.
            $normalized = array_map(function ($ci) {
                $timeStr = strlen($ci['time']) === 5 ? $ci['time'] . ':00' : $ci['time'];
                $endTimeStr = strlen($ci['end_time']) === 5 ? $ci['end_time'] . ':00' : $ci['end_time'];

                return [
                    'date' => $ci['date'],
                    'time' => $timeStr,
                    'end_time' => $endTimeStr,
                    'hour' => (int) explode(':', $timeStr)[0],
                    'quantity' => $ci['quantity'] ?? 1,
                ];
            }, $cartItems);

            usort($normalized, function ($a, $b) {
                return [$a['date'], $a['hour']] <=> [$b['date'], $b['hour']];
            });

            // Reject past time slots — the availability endpoint hides these, but nothing
            // previously stopped a direct booking request from creating one anyway.
            $todayStr = now()->format('Y-m-d');
            $currentHour = now()->hour;
            foreach ($normalized as $item) {
                $isPast = ($item['date'] < $todayStr) || ($item['date'] === $todayStr && $item['hour'] <= $currentHour);
                if ($isPast) {
                    throw new Exception("Cannot book {$item['time']} on {$item['date']} — this time slot has already passed.");
                }
            }

            // Group into contiguous sessions: same date, same court quantity, back-to-back hours.
            $sessions = [];
            $current = null;
            foreach ($normalized as $item) {
                if (
                    $current !== null
                    && $current['date'] === $item['date']
                    && $current['quantity'] === $item['quantity']
                    && $current['lastHour'] + 1 === $item['hour']
                ) {
                    $current['slots'][] = $item;
                    $current['lastHour'] = $item['hour'];
                } else {
                    if ($current !== null) {
                        $sessions[] = $current;
                    }
                    $current = [
                        'date' => $item['date'],
                        'quantity' => $item['quantity'],
                        'lastHour' => $item['hour'],
                        'slots' => [$item],
                    ];
                }
            }
            if ($current !== null) {
                $sessions[] = $current;
            }

            // Prefetch existing active bookings per date|start_time so eligibility checks
            // across a whole session don't re-query the DB per court.
            $existingBookedMap = [];
            foreach (array_unique(array_column($normalized, 'date')) as $date) {
                $items = BookingItem::where('booking_date', $date)
                    ->whereHas('booking', fn ($q) => $q->where('booking_status', '!=', 'cancelled'))
                    ->get(['court_id', 'start_time']);

                foreach ($items as $item) {
                    $existingBookedMap[$date][$item->start_time][] = $item->court_id;
                }
            }

            $assignedSlots = [];
            $claimedInTx = []; // Key: date|time -> Array of claimed court_ids

            foreach ($sessions as $session) {
                $date = $session['date'];
                $quantity = $session['quantity'];
                $slots = $session['slots'];

                $isAllClosed = CourtClosure::where('start_date', '<=', $date)
                    ->where('end_date', '>=', $date)
                    ->whereNull('court_id')
                    ->exists();

                if ($isAllClosed) {
                    throw new Exception("All courts are closed on date {$date}.");
                }

                $closedCourtIds = CourtClosure::where('start_date', '<=', $date)
                    ->where('end_date', '>=', $date)
                    ->pluck('court_id')
                    ->filter()
                    ->toArray();

                // A court is eligible for the session only if it's free for every hour in it.
                $eligibleCourts = $activeCourts->filter(function ($court) use ($slots, $closedCourtIds, $claimedInTx, $existingBookedMap, $date) {
                    if (in_array($court->id, $closedCourtIds)) {
                        return false;
                    }

                    $cOpen = (int) explode(':', $court->opening_time)[0];
                    $cClose = (int) explode(':', $court->closing_time)[0];

                    foreach ($slots as $slot) {
                        if ($slot['hour'] < $cOpen || $slot['hour'] >= $cClose) {
                            return false;
                        }

                        $txKey = "{$date}|{$slot['time']}";
                        if (in_array($court->id, $claimedInTx[$txKey] ?? [])) {
                            return false;
                        }

                        if (in_array($court->id, $existingBookedMap[$date][$slot['time']] ?? [])) {
                            return false;
                        }
                    }

                    return true;
                });

                if ($eligibleCourts->count() < $quantity) {
                    $rangeLabel = count($slots) > 1
                        ? "{$slots[0]['time']} - {$slots[count($slots) - 1]['end_time']}"
                        : $slots[0]['time'];
                    throw new Exception("No court is available for the full {$rangeLabel} duration on {$date} ({$quantity} court(s) requested).");
                }

                // Shuffle randomly behind the scenes, but pick the court(s) ONCE per session
                // so the same court carries through every hour of that session.
                $selectedCourts = $eligibleCourts->shuffle()->values()->take($quantity);

                foreach ($slots as $slot) {
                    $txKey = "{$date}|{$slot['time']}";
                    if (!isset($claimedInTx[$txKey])) {
                        $claimedInTx[$txKey] = [];
                    }

                    foreach ($selectedCourts as $selectedCourt) {
                        $claimedInTx[$txKey][] = $selectedCourt->id;

                        $assignedSlots[] = [
                            'court_id' => $selectedCourt->id,
                            'court_name' => $selectedCourt->name,
                            'booking_date' => $date,
                            'start_time' => $slot['time'],
                            'end_time' => $slot['end_time'],
                            'slot_price' => $pricing['effective_rate_per_hour'],
                        ];
                    }
                }
            }

            // Create Master Booking Record
            $refCode = 'PAD-' . strtoupper(Str::random(5));

            $booking = Booking::create([
                'reference_code' => $refCode,
                'customer_phone' => $customerPhone,
                'customer_name' => $customerName,
                'customer_email' => $customerEmail,
                // Use the chronologically-earliest date from the sorted/normalized cart
                // (not the raw client-submitted order) so admin date-filtering, which
                // matches this column exactly, doesn't miss multi-date bookings.
                'booking_date' => $normalized[0]['date'],
                'total_duration_hours' => $totalDuration,
                'subtotal_amount' => $pricing['subtotal'],
                'discount_amount' => $pricing['discount_amount'],
                'total_amount' => $pricing['final_total'],
                'currency' => 'OMR',
                'payment_method' => $paymentMethod,
                'payment_status' => 'pending',
                // An online booking holds its slots but is NOT confirmed until
                // Thawani tells us the money actually arrived. Pay-on-arrival is
                // confirmed immediately — settlement happens at the counter.
                'booking_status' => $paymentMethod === 'thawani' ? 'pending_payment' : 'confirmed',
            ]);

            // Every booking gets a payment record, so arrival and online bookings
            // reconcile through the same table.
            Payment::create([
                'booking_id' => $booking->id,
                'method' => $paymentMethod,
                'status' => 'pending',
                'amount' => $pricing['final_total'],
                'currency' => 'OMR',
                'provider' => $paymentMethod === 'thawani' ? 'thawani' : null,
            ]);

            // Create Items with assigned random court IDs
            foreach ($assignedSlots as $slotData) {
                BookingItem::create([
                    'booking_id' => $booking->id,
                    'court_id' => $slotData['court_id'],
                    'booking_date' => $slotData['booking_date'],
                    'start_time' => $slotData['start_time'],
                    'end_time' => $slotData['end_time'],
                    'slot_price' => $slotData['slot_price'],
                ]);
            }

            return $booking->load('items.court');
        });
    }

    /**
     * Look up a single booking for a customer. Both the reference code AND the
     * phone number used to book must match — requiring the pair keeps someone
     * from enumerating other people's bookings with just one of the two.
     */
    public function findForCustomer(string $referenceCode, string $phone): ?Booking
    {
        return Booking::with('items.court')
            ->where('reference_code', strtoupper(trim($referenceCode)))
            ->where('customer_phone', trim($phone))
            ->first();
    }

    /**
     * Customer-initiated cancellation, subject to the published policy: only
     * still-active bookings, and only up to CANCELLATION_WINDOW_HOURS before
     * the first booked slot begins.
     */
    public function cancelForCustomer(Booking $booking): Booking
    {
        if ($booking->booking_status === 'cancelled') {
            throw new Exception('This booking has already been cancelled.');
        }

        $firstSlotAt = $this->firstSlotStartsAt($booking);

        if ($firstSlotAt === null || $firstSlotAt->isPast()) {
            throw new Exception('This booking has already taken place and can no longer be cancelled.');
        }

        if ($firstSlotAt->lessThan(now()->addHours(self::CANCELLATION_WINDOW_HOURS))) {
            throw new Exception(
                'Bookings can only be cancelled at least '.self::CANCELLATION_WINDOW_HOURS.
                ' hours before the session starts. Please call the club to change this booking.'
            );
        }

        $booking->update(['booking_status' => 'cancelled']);

        return $booking->load('items.court');
    }

    /**
     * Earliest start datetime across all of a booking's slots.
     */
    protected function firstSlotStartsAt(Booking $booking): ?Carbon
    {
        $items = $booking->relationLoaded('items') ? $booking->items : $booking->items()->get();

        $starts = $items->map(function ($item) {
            $date = $item->booking_date instanceof \DateTimeInterface
                ? $item->booking_date->format('Y-m-d')
                : $item->booking_date;

            return Carbon::parse($date.' '.$item->start_time);
        });

        return $starts->isEmpty() ? null : $starts->sort()->first();
    }
}
