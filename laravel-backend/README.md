# Padel Court Booking Platform — Laravel 11 Backend

Pure JSON REST API. No views, no web sessions. Consumed by the React/Vite frontend via `/api/*`.

## Requirements

| Requirement | Version |
|---|---|
| PHP | 8.2+ |
| Composer | 2.x |
| SQLite ext | bundled with PHP (default) |
| MySQL / PostgreSQL | optional (production) |

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed    # creates DB + seeds 8 courts & 3 pricing tiers
php artisan serve --port=8000
```

## Architecture

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── CustomerBookingController.php  ← availability, pricing, booking
│   │   ├── AdminCourtController.php       ← courts, closures, pricing rules
│   │   ├── AdminBookingController.php     ← booking list, cancel
│   │   └── ThawaniPaymentController.php   ← checkout session, verify, webhook
│   └── Resources/                         ← JSON transformers (snake_case → camelCase)
│       ├── CourtResource.php
│       ├── CourtClosureResource.php
│       ├── TieredPricingRuleResource.php
│       └── BookingResource.php
├── Models/
│   ├── Court.php
│   ├── CourtClosure.php
│   ├── TieredPricingRule.php
│   ├── Booking.php
│   └── BookingItem.php
└── Services/
    ├── BookingService.php      ← pooled availability + atomic cart checkout + random court assignment
    ├── PricingService.php      ← tiered duration pricing engine
    └── ThawaniPaymentService.php
```

## Key Design Decisions

- **Anonymous court pooling**: `/api/slots/availability` returns counts only — court names are never exposed to customers.
- **Atomic booking**: `BookingService::createBooking()` wraps everything in a `DB::transaction()` with `lockForUpdate()` to prevent double-booking under concurrent requests.
- **Random assignment**: courts are shuffled inside the transaction before being written to `booking_items`.
- **camelCase API**: all JSON responses are transformed via Laravel API Resources so the TypeScript frontend doesn't need conversion.
