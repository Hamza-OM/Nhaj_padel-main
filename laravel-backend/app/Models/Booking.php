<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference_code',
        'customer_phone',
        'customer_name',
        'customer_email',
        'booking_date',
        'total_duration_hours',
        'subtotal_amount',
        'discount_amount',
        'total_amount',
        'currency',
        'payment_method',
        'payment_status',
        'booking_status',
    ];

    protected $casts = [
        'total_duration_hours' => 'integer',
        'subtotal_amount' => 'float',
        'discount_amount' => 'float',
        'total_amount' => 'float',
    ];

    public function items()
    {
        return $this->hasMany(BookingItem::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    /** The attempt currently in play — most recent payment row. */
    public function latestPayment()
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    /**
     * When the last booked hour actually finishes.
     *
     * The `booking_date` column is the *earliest* date in the booking, so it
     * says nothing about when the session ends — a cart spanning two dates
     * would look finished the day after its first slot. The real end is the
     * latest date+end_time across the items, which is also what makes a
     * multi-hour booking stay live until its final hour is over.
     */
    public function endsAt(): ?Carbon
    {
        $items = $this->relationLoaded('items') ? $this->items : $this->items()->get();

        $ends = $items->map(function ($item) {
            $date = $item->booking_date instanceof \DateTimeInterface
                ? $item->booking_date->format('Y-m-d')
                : $item->booking_date;

            return Carbon::parse($date.' '.$item->end_time);
        });

        return $ends->isEmpty() ? null : $ends->sort()->last();
    }

    /**
     * 'completed' is derived, never stored: a confirmed booking becomes
     * completed once its final hour has passed. Deliberately says nothing
     * about money — a pay-on-arrival session stays unpaid until a member of
     * staff settles it, which is a separate decision entirely.
     */
    public function isCompleted(): bool
    {
        if ($this->booking_status !== 'confirmed') {
            return false;
        }

        return $this->endsAt()?->isPast() ?? false;
    }

    /**
     * Bookings with at least one hour still to come. Expressed as separate
     * date and time comparisons rather than concatenating them into a
     * datetime, which keeps it portable across SQLite and MySQL.
     */
    public function scopeSessionStillToCome(Builder $query): Builder
    {
        $today = now()->toDateString();
        $timeNow = now()->format('H:i:s');

        return $query->whereHas('items', function (Builder $q) use ($today, $timeNow) {
            $q->where('booking_date', '>', $today)
                ->orWhere(function (Builder $sameDay) use ($today, $timeNow) {
                    $sameDay->where('booking_date', $today)->where('end_time', '>', $timeNow);
                });
        });
    }

    /** The inverse: every booked hour is already over. */
    public function scopeSessionFinished(Builder $query): Builder
    {
        $today = now()->toDateString();
        $timeNow = now()->format('H:i:s');

        return $query->whereDoesntHave('items', function (Builder $q) use ($today, $timeNow) {
            $q->where('booking_date', '>', $today)
                ->orWhere(function (Builder $sameDay) use ($today, $timeNow) {
                    $sameDay->where('booking_date', $today)->where('end_time', '>', $timeNow);
                });
        });
    }
}
