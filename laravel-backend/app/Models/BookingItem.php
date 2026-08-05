<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'court_id',
        'booking_date',
        'start_time',
        'end_time',
        'slot_price',
    ];

    protected $casts = [
        'slot_price' => 'float',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function court()
    {
        return $this->belongsTo(Court::class);
    }
}
