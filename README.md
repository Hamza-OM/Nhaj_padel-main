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
| Username | `admin@padel.com` |
| Password | `admin123` |

*(Credentials are stored in the frontend AppContext — no backend auth is wired by default.)*

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
npm run dev
```

The app runs on **http://localhost:5173**.  
`vite.config.ts` proxies all `/api/*` requests to `http://127.0.0.1:8000`, so no CORS issues during development.

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
| `POST` | `/api/payments/thawani/create-session` | Initiate Thawani checkout |
| `POST` | `/api/payments/thawani/verify` | Verify / simulate payment result |

### Admin

> All `/api/admin/*` routes require an `X-Admin-Key` header matching `ADMIN_API_KEY`
> in `laravel-backend/.env`. Requests without it get a `401`.

| Method | Path | Description |
|---|---|---|
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

## 💳 Thawani Payment Gateway (Sandbox)

Configure in `laravel-backend/.env`:

```
THAWANI_MODE=sandbox
THAWANI_SECRET_KEY=rQ0w...
THAWANI_PUBLISHABLE_KEY=HG9w...
```

The platform supports simulating **Payment Success** and **Payment Cancellation** via the sandbox modal in the UI.

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
5. Set a strong `ADMIN_API_KEY` in `laravel-backend/.env` and the matching
   `VITE_ADMIN_API_KEY` in the frontend build environment.
