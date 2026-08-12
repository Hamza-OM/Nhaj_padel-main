<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent once a booking is actually confirmed — immediately for pay-on-arrival,
 * and only after Thawani reports a settled payment for online checkout. A
 * booking sitting in pending_payment must never trigger this.
 *
 * Implements ShouldQueue so production can move it off the request cycle by
 * switching QUEUE_CONNECTION; with the default `sync` driver it still sends
 * inline, so no queue worker is needed for local dev or a demo.
 */
class BookingConfirmed extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "تأكيد الحجز {$this->booking->reference_code} · Booking confirmed",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.booking-confirmed',
            with: [
                'booking' => $this->booking->loadMissing('items'),
                'lookupUrl' => rtrim((string) config('app.frontend_url'), '/').'/my-booking',
            ],
        );
    }
}
