<?php

use App\Http\Controllers\AdminBookingController;
use App\Http\Controllers\AdminCourtController;
use App\Http\Controllers\CustomerBookingController;
use App\Http\Controllers\ThawaniPaymentController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Padel Court Booking Platform
|--------------------------------------------------------------------------
|
| Routes exactly mirror the URL paths used by src/services/api.ts so the
| React/Vite frontend works without any frontend code changes.
|
*/

// ── Customer Routes ──────────────────────────────────────────────────────────

// GET  /api/slots/availability?date=YYYY-MM-DD
Route::get('/slots/availability', [CustomerBookingController::class, 'availability']);

// POST /api/pricing/calculate  { totalHours }
Route::post('/pricing/calculate', [CustomerBookingController::class, 'calculatePricing']);

// POST /api/bookings  { customerPhone, customerName?, customerEmail?, paymentMethod, cartItems }
Route::post('/bookings', [CustomerBookingController::class, 'store']);

// Customer self-service booking lookup & cancellation. Reference codes are short
// (PAD- + 5 chars), so these are rate limited to blunt brute-force enumeration.
Route::middleware('throttle:10,1')->group(function () {
    // GET  /api/bookings/lookup?reference=PAD-XXXXX&phone=9xxxxxxx
    Route::get('/bookings/lookup', [CustomerBookingController::class, 'lookup']);

    // POST /api/bookings/cancel  { reference, phone }
    Route::post('/bookings/cancel', [CustomerBookingController::class, 'cancel']);
});

// POST /api/payments/thawani/create-session  { bookingId }
// Amount is never taken from the client — it comes from the priced booking.
Route::post('/payments/thawani/create-session', [ThawaniPaymentController::class, 'createSession']);

// GET /api/payments/thawani/result?reference=PAD-XXXXX
// Where the customer lands after Thawani. Status is verified server-side.
Route::get('/payments/thawani/result', [ThawaniPaymentController::class, 'result'])
    ->middleware('throttle:20,1');

// ── Admin Routes ─────────────────────────────────────────────────────────────

Route::prefix('admin')->middleware('admin.key')->group(function () {

    // Courts CRUD
    Route::get('/courts',              [AdminCourtController::class, 'index']);
    Route::post('/courts',             [AdminCourtController::class, 'store']);
    Route::put('/courts/{court}',      [AdminCourtController::class, 'update']);
    Route::delete('/courts/{court}',   [AdminCourtController::class, 'destroy']);

    // Court Closures / Blackouts
    Route::get('/closures',               [AdminCourtController::class, 'getClosures']);
    Route::post('/closures',              [AdminCourtController::class, 'storeClosure']);
    Route::delete('/closures/{closure}',  [AdminCourtController::class, 'destroyClosure']);

    // Tiered Pricing Rules
    Route::get('/pricing-rules',   [AdminCourtController::class, 'getPricingRules']);
    Route::post('/pricing-rules',  [AdminCourtController::class, 'storePricingRule']);

    // Booking Management
    Route::get('/bookings',                       [AdminBookingController::class, 'index']);
    Route::post('/bookings/{booking}/cancel',     [AdminBookingController::class, 'cancel']);
});

// ── Thawani Server-to-Server Webhook (production) ───────────────────────────
Route::post('/webhooks/thawani', [ThawaniPaymentController::class, 'webhook']);
