# 🎾 Padel Court Booking Platform

A full-stack web application for managing padel court bookings, featuring an **Admin Dashboard** and a **Customer Booking Portal**.

- **Anonymous Slot Pooling** — court names are hidden from customers until booking confirmation
- **Random Court Assignment** — dynamically allocates physical courts from available slot pools
- **Tiered Duration Pricing** — 1 h @ 10 OMR/hr · 2 h @ 8 OMR/hr · 3+ h @ 7 OMR/hr
- **Cart-Style Multi-Slot Booking** — customers can book multiple slots/courts in one transaction
- **Thawani Payment Gateway** — sandbox checkout & payment status verification

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons |
| Backend | **Laravel 11 / PHP 8.2** |
| Database | SQLite (local dev) · MySQL / PostgreSQL (production) |
| Payments | Thawani E-Commerce Gateway (Sandbox) |

---

## 🔐 Admin Dashboard Credentials

| Field | Value |
|---|---|
| Email | `admin@padel.com` |
| Password | `Demo-5e977ff12f8c` |

This account is created by the database seeder (`php artisan migrate --seed`) with
a properly hashed password — logging in calls `POST /api/admin/login`, which the
backend verifies against that hash and, on success, issues a Sanctum session token.
That token (not a login-screen check, and not any secret baked into the frontend
build) is what every `/api/admin/*` request is actually authorized by. Change
`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `laravel-backend/.env` before deploying this
anywhere beyond local dev.

---

## ⚡ Quick Start

You need **two terminals**: one for the Laravel API, one for the Vite frontend.

### 1 — Laravel Backend

```bash
cd laravel-backend

# Install PHP dependencies
composer install

# Copy and configure environment
cp .env.example .env
php artisan key:generate

# Run migrations + seed default courts & pricing rules
php artisan migrate --seed

# Start API server on http://localhost:8000
php artisan serve --port=8000
```

> **SQLite (default):** Laravel creates `laravel-backend/database/database.sqlite` automatically.
> For MySQL/PostgreSQL, edit `DB_CONNECTION`, `DB_HOST`, `DB_DATABASE`, etc. in `.env`.

### 2 — React Frontend

In a **second terminal**:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The app runs on **http://localhost:5173**.  
`vite.config.ts` proxies all `/api/*` requests to `http://127.0.0.1:8000`, so no CORS issues during development.

Nothing else to configure — `/admin` is ready to use with the seeded credentials above.

> **Note on `npm install`'s "2 high severity vulnerabilities" warning**: this is
> `react-router-dom`'s [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2),
> an RSC (React Server Components) mode CSRF issue. This app is a pure client-rendered
> SPA (`BrowserRouter`, no server rendering, no RSC APIs used anywhere) — the vulnerable
> code path doesn't exist here. `7.18.2` is the newest version published; `npm audit fix
> --force` would *downgrade* to `7.11.0`, trading this inapplicable advisory for several
> real, older ones. Leave it as-is.

---

## 🗂️ Project Structure

```
padel-court-booking-platform/
├── frontend/                   ← React 19 / TypeScript / Vite SPA
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/api.ts     ← API calls (all under /api/...)
│   │   └── types.ts
│   ├── public/
│   ├── vite.config.ts          ← /api proxy → Laravel :8000
│   ├── package.json
│   └── .env.example
├── laravel-backend/            ← Laravel 11 API
│   ├── app/
│   │   ├── Http/Controllers/
│   │   ├── Http/Resources/     ← JSON transformers (snake_case → camelCase)
│   │   ├── Models/
│   │   └── Services/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── routes/api.php          ← All API routes
│   ├── composer.json
│   └── .env.example
└── README.md                   ← you are here
```

Frontend and backend are two fully independent applications sharing this
repo — the Laravel side serves a pure JSON API (see `laravel-backend/routes/web.php`),
and the React app is a static SPA that talks to it over HTTP.

---

## 🧭 Pages

The frontend is a single-page app with real, linkable URLs (React Router):

| Path | Page |
|---|---|
| `/` | Home / landing page |
| `/book` | Book a court (date picker, slot cart, checkout) |
| `/rates` | Courts & tiered rates |
| `/info` | Club info, hours, amenities, FAQ |
| `/my-booking` | Look up or cancel your own booking |
| `/payment/result` | Where Thawani returns the customer; shows the verified outcome |
| `/admin` | Admin dashboard |

Any unknown path redirects to `/`.

---

## 🌐 API Reference

All routes are prefixed with `/api`.

### Customer

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/slots/availability?date=YYYY-MM-DD` | Pooled slot availability |
| `POST` | `/api/pricing/calculate` | Tiered price preview |
| `POST` | `/api/bookings` | Place a booking |
| `GET` | `/api/bookings/lookup?reference=&phone=` | Retrieve own booking (rate limited) |
| `POST` | `/api/bookings/cancel` | Self-service cancel, 6 h policy (rate limited) |
| `POST` | `/api/payments/thawani/create-session` | Open a real Thawani checkout session (`{bookingId}` only — amount is server-side) |
| `GET` | `/api/payments/thawani/result?reference=` | Server-verified payment outcome after returning from Thawani |

### Admin

> All `/api/admin/*` routes (except `/admin/login`) require a Sanctum bearer token:
> `Authorization: Bearer <token>`, obtained from `POST /admin/login` and sent
> automatically by the frontend after a real login. Requests without a valid
> token get a `401`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/login` | `{email, password}` → `{token, user}` (rate limited) |
| `POST` | `/api/admin/logout` | Revoke the current session token |
| `GET` | `/api/admin/me` | Confirm the current token is still valid |
| `GET` | `/api/admin/courts` | List courts |
| `POST` | `/api/admin/courts` | Add court |
| `PUT` | `/api/admin/courts/{id}` | Update court |
| `DELETE` | `/api/admin/courts/{id}` | Delete court |
| `GET` | `/api/admin/closures` | List closures |
| `POST` | `/api/admin/closures` | Add closure/blackout |
| `DELETE` | `/api/admin/closures/{id}` | Remove closure |
| `GET` | `/api/admin/pricing-rules` | List pricing tiers |
| `POST` | `/api/admin/pricing-rules` | Add pricing tier |
| `GET` | `/api/admin/bookings` | List bookings (filterable) |
| `POST` | `/api/admin/bookings/{id}/cancel` | Cancel booking |

### Webhooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/webhooks/thawani` | Thawani server-to-server webhook |

---

## 💳 Thawani Payment Gateway (UAT / Sandbox)

This is a **real** integration against Thawani's UAT environment — the customer is
redirected to Thawani's hosted checkout and the payment result is verified
server-side. There is no simulator in the payment path.

### Configuration

`laravel-backend/.env.example` already ships with Thawani's own publicly
documented UAT test credentials (from https://developer.thawani.om/) — the
same shared sandbox keys Thawani publishes for any developer to integrate
against, not a real merchant's secret. `cp .env.example .env` is enough;
online payment works immediately, no signup or key generation required.

```
THAWANI_MODE=uat
THAWANI_SECRET_KEY=rRQ26GcsZzoEhbrP2HZvLYDbn9C9et
THAWANI_PUBLISHABLE_KEY=HGvTMLDssJghr9tlN9gr4DVYt0qyBy
THAWANI_BASE_URL=https://uatcheckout.thawani.om/api/v1
THAWANI_CHECKOUT_URL=https://uatcheckout.thawani.om/pay
THAWANI_WEBHOOK_SECRET=          # from Merchant Portal > Webhook config
FRONTEND_URL=http://localhost:5173   # must match the SPA origin — used for return URLs
```

The **secret key is backend-only**: it is never sent to React, never included
in an API response, and never logged. For a real production deployment, get
your own keys from the Thawani merchant portal (Settings > Developers) —
those, unlike the shared UAT ones above, must never be committed.

### Checkout flow

```
Customer picks slots  →  POST /api/bookings
                             ↓  server re-checks availability in a locked
                                transaction, prices the booking, assigns a court
                         booking = pending_payment, payment = pending
                             ↓
                         POST /api/payments/thawani/create-session
                             ↓  Laravel → Thawani  (amount from the booking, in baisa)
                         browser redirects to Thawani hosted checkout
                             ↓
                    customer pays / cancels on Thawani
                             ↓
              return to /payment/result?ref=PAD-XXXXX
                             ↓  Laravel calls Thawani's Retrieve Session
                        booking = confirmed | cancelled   payment = paid | cancelled | expired
```

The return URL is **not** proof of payment. Both it and the webhook re-query
Thawani before anything is written.

### Statuses

| Booking | Meaning |
|---|---|
| `pending_payment` | Slots held, awaiting online payment |
| `confirmed` | Paid online, or booked as pay-on-arrival |
| `cancelled` | Payment cancelled/expired, or cancelled by customer/admin |
| `completed` | Derived — a confirmed booking whose date has passed |

| Payment | Meaning |
|---|---|
| `pending` | Created, not settled |
| `paid` | Confirmed by Thawani |
| `failed` / `cancelled` / `expired` | Terminal, booking not confirmed |

`unpaid` is Thawani's **initial** session state, not a failure — it maps to
`pending` and never cancels a booking.

### Webhook

`POST /api/webhooks/thawani` verifies an HMAC-SHA256 signature
(`HMAC(body + '-' + timestamp, THAWANI_WEBHOOK_SECRET)`, compared against the
`thawani-signature` header). Handled events: `checkout.completed`,
`payment.succeeded`, `payment.failed`; `checkout.created` and `payment.pending`
are acknowledged as no-ops. Processing is idempotent — a replayed delivery
cannot double-settle a payment or duplicate a booking.

> Thawani cannot reach `localhost`. To exercise webhooks locally, expose the
> backend with a tunnel (e.g. ngrok) and register that URL in the portal.
> Leaving `THAWANI_WEBHOOK_SECRET` blank skips signature verification, which is
> acceptable only in local development.

### Testing

```bash
cd laravel-backend && vendor/bin/phpunit
```

Covers pay-on-arrival, session creation, gateway failure, duplicate
"Confirm & Pay", paid/cancelled/expired/unpaid outcomes, webhook signature
rejection, duplicate webhooks, price tampering, court non-disclosure, and the
availability race condition. Thawani calls are stubbed with `Http::fake()`, so
the suite never touches the network.

---

## 🚀 Production Deployment

1. Build the frontend: `cd frontend && npm run build` → outputs to `frontend/dist/`
2. Point your web server (Nginx/Apache) to `laravel-backend/public` for `/api/*` and to `frontend/dist/` for everything else.
3. **Enable SPA history fallback.** The frontend uses client-side routing, so any
   unknown path must serve `index.html` rather than returning 404 — otherwise
   deep links like `/my-booking` break on refresh or when opened directly.

   *Nginx:*
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```

   *Apache* — add `frontend/dist/.htaccess`:
   ```apache
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```
4. Set `APP_ENV=production`, `APP_DEBUG=false`, and run `php artisan config:cache`.
5. Set a real `ADMIN_EMAIL` / strong `ADMIN_PASSWORD` in `laravel-backend/.env`
   before running the seeder — these become the only admin login.
6. Replace `THAWANI_MODE`, `THAWANI_SECRET_KEY`, and `THAWANI_PUBLISHABLE_KEY`
   with your own production credentials from the Thawani merchant portal — the
   values in `.env.example` are Thawani's shared UAT-only test keys and can't
   process real payments.
