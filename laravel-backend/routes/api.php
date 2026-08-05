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

// POST /api/payments/thawani/create-session  { bookingId, totalAmount }
Route::post('/payments/thawani/create-session', [ThawaniPaymentController::class, 'createSession']);

// POST /api/payments/thawani/verify  { sessionId, status }
Route::post('/payments/thawani/verify', [ThawaniPaymentController::class, 'verify']);

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
