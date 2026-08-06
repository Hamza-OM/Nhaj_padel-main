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
│   │   └── ThawaniPaymentController.php   ← checkout session, result, webhook
│   ├── Middleware/
│   │   └── VerifyAdminKey.php             ← X-Admin-Key guard on /api/admin/*
│   └── Resources/                         ← JSON transformers (snake_case → camelCase)
│       ├── CourtResource.php
│       ├── CourtClosureResource.php
│       ├── TieredPricingRuleResource.php
│       ├── BookingResource.php            ← customer-facing: NO court identifiers
│       └── AdminBookingResource.php       ← same + assigned court, for staff
├── Models/
│   ├── Court.php
│   ├── CourtClosure.php
│   ├── TieredPricingRule.php
│   ├── Booking.php
│   ├── BookingItem.php
│   └── Payment.php             ← one row per payment attempt
├── Exceptions/
│   └── PaymentGatewayException.php
└── Services/
    ├── BookingService.php      ← pooled availability + atomic cart checkout + random court assignment
    ├── PricingService.php      ← tiered duration pricing engine
    └── ThawaniService.php      ← Thawani REST API (real calls only, no fallback)
```

## Key Design Decisions

- **Anonymous court pooling**: `/api/slots/availability` returns counts only, and
  `BookingResource` omits `courtId`/`courtName` entirely. The assigned court is an
  internal allocation detail — only `AdminBookingResource` exposes it.
- **Atomic booking**: `BookingService::createBooking()` wraps everything in a
  `DB::transaction()` with `lockForUpdate()` to prevent double-booking under
  concurrent requests. Availability is re-checked inside that transaction, never
  trusted from what the browser last rendered.
- **Random assignment**: courts are shuffled inside the transaction, and a run of
  consecutive hours stays on the same court for the whole session.
- **Server-side money**: totals come from `PricingService`. No endpoint accepts an
  amount from the client — `create-session` takes only a `bookingId`.
- **Payments are separate rows**: a booking can accumulate several attempts (a
  cancelled checkout, then a successful retry). `provider_session_id` is unique,
  which is what makes webhook and return-URL processing idempotent.
- **Never trust the client for payment state**: both the return URL and the webhook
  re-query Thawani's Retrieve Session endpoint before writing anything. A forged
  webhook body claiming `paid` cannot confirm a booking.
- **Fail loudly**: if Thawani cannot create a session the request returns `502` with
  a generic message. No placeholder session id is ever fabricated.
- **camelCase API**: all JSON responses are transformed via Laravel API Resources so
  the TypeScript frontend doesn't need conversion.

## Testing

```bash
vendor/bin/phpunit
```

`phpunit.xml` runs against an in-memory SQLite database and stubs all Thawani
traffic with `Http::fake()`, so the suite is offline and deterministic.

See the root [README](../README.md) for the full Thawani setup, checkout flow,
status vocabulary and webhook details.
