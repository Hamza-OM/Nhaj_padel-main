<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CourtClosure extends Model
{
    use HasFactory;

    protected $fillable = [
        'court_id',
        'start_date',
        'end_date',
        'reason',
    ];
}
