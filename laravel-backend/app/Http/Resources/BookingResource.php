<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Customer-facing booking payload.
 *
 * Deliberately omits the assigned physical court: courts are pooled anonymously
 * and which one you get is an internal allocation detail. Admin screens use
 * AdminBookingResource, which does include it.
 */
class BookingResource extends JsonResource
{
    /** Subclasses flip this on to include court identifiers. */
    protected bool $includeCourt = false;

    public function toArray(Request $request): array
    {
        $bookingDate = $this->booking_date instanceof \DateTimeInterface
            ? $this->booking_date->format('Y-m-d')
            : $this->booking_date;

        // Nothing ever writes booking_status = 'completed' in the DB — a confirmed
        // booking is treated as completed once its date has passed.
        $bookingStatus = $this->booking_status;
        if ($bookingStatus === 'confirmed' && $bookingDate < now()->format('Y-m-d')) {
            $bookingStatus = 'completed';
        }

        return [
            'id' => (string) $this->id,
            'referenceCode' => $this->reference_code,
            'customerPhone' => $this->customer_phone,
            'customerName' => $this->customer_name,
            'customerEmail' => $this->customer_email,
            'bookingDate' => $bookingDate,
            'totalDurationHours' => (int) $this->total_duration_hours,
            'subtotalAmount' => (float) $this->subtotal_amount,
            'discountAmount' => (float) $this->discount_amount,
            'totalAmount' => (float) $this->total_amount,
            'currency' => $this->currency,
            'paymentMethod' => $this->payment_method,
            'paymentStatus' => $this->payment_status,
            'bookingStatus' => $bookingStatus,
            'thawaniSessionId' => $this->thawani_session_id,
            'thawaniPaymentUrl' => $this->thawani_payment_url,
            'assignedSlots' => $this->whenLoaded('items', function () {
                return $this->items->map(function ($item) {
                    $slot = [
                        'slotTime' => substr($item->start_time, 0, 5),
                        'endTime' => substr($item->end_time, 0, 5),
                        'date' => $item->booking_date instanceof \DateTimeInterface
                            ? $item->booking_date->format('Y-m-d')
                            : $item->booking_date,
                        'price' => (float) $item->slot_price,
                    ];

                    if ($this->includeCourt) {
                        $slot['courtId'] = (string) $item->court_id;
                        $slot['courtName'] = optional($item->court)->name;
                    }

                    return $slot;
                });
            }, []),
            'createdAt' => optional($this->created_at)->toISOString(),
        ];
    }
}
