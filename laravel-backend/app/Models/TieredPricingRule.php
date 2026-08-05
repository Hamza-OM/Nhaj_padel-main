<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TieredPricingRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'min_hours',
        'max_hours',
        'rate_per_hour',
        'description',
        'is_active',
    ];

    protected $casts = [
        'min_hours' => 'integer',
        'max_hours' => 'integer',
        'rate_per_hour' => 'float',
        'is_active' => 'boolean',
    ];
}
