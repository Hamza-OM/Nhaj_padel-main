<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'method',
        'status',
        'amount',
        'currency',
        'provider',
        'provider_session_id',
        'provider_transaction_id',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'float',
        'metadata' => 'array',
    ];

    /** Statuses that can still change — anything else is settled. */
    public const OPEN_STATUSES = ['pending'];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function isSettled(): bool
    {
        return ! in_array($this->status, self::OPEN_STATUSES, true);
    }
}
