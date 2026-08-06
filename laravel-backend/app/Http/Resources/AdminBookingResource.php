<?php

namespace App\Http\Resources;

/**
 * Admin-facing booking payload — identical to the customer one but with the
 * assigned physical court included, which staff need for the floor schedule.
 */
class AdminBookingResource extends BookingResource
{
    protected bool $includeCourt = true;
}
