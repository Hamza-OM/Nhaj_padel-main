<?php

namespace App\Models;

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
}
