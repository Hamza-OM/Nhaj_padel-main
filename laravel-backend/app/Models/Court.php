<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Court extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'base_price_per_hour',
        'opening_time',
        'closing_time',
        'is_active',
        'surface_type',
    ];

    protected $casts = [
        'base_price_per_hour' => 'float',
        'is_active' => 'boolean',
    ];
}
