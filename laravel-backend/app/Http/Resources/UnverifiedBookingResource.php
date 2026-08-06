<?php

namespace App\Http\Resources;

/**
 * Booking payload for callers who only proved they know the reference code,
 * not that they own the booking (e.g. the Thawani return-URL landing page).
 * The reference code ends up in browser history, redirect URLs, and referrer
 * headers, so it isn't treated as a secret — no PII is included here.
 */
class UnverifiedBookingResource extends BookingResource
{
    protected bool $includePii = false;
}
