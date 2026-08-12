<?php

namespace App\Services;

use App\Mail\BookingConfirmed;
use App\Models\Booking;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Delivery of customer-facing booking mail.
 *
 * Two rules this class exists to guarantee, in one place rather than at each
 * call site: an email address is optional on a booking, and a mail failure
 * must never surface to the customer as a failed booking or a failed payment.
 */
class BookingNotificationService
{
    public function sendConfirmation(Booking $booking): void
    {
        if (blank($booking->customer_email)) {
            return;
        }

        try {
            Mail::to($booking->customer_email)->send(new BookingConfirmed($booking));
        } catch (\Throwable $e) {
            // The booking is already made and paid for — a mail outage is not
            // the customer's problem. Record it and move on.
            Log::warning('Booking confirmation email failed to send', [
                'booking_reference' => $booking->reference_code,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
