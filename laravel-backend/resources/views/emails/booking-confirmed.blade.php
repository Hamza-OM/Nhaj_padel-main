@php
    $slots = $booking->items->sortBy(fn ($i) => $i->booking_date.' '.$i->start_time);
    $first = $slots->first();
    $last = $slots->last();
    $dateLabel = $first
        ? ($first->booking_date instanceof \DateTimeInterface
            ? $first->booking_date->format('Y-m-d')
            : $first->booking_date)
        : ($booking->booking_date instanceof \DateTimeInterface
            ? $booking->booking_date->format('Y-m-d')
            : $booking->booking_date);
    $paidOnline = $booking->payment_status === 'paid';
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $booking->reference_code }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;">

    <tr>
        <td style="background:#0b1326;padding:28px 32px;">
            <div style="color:#c3f400;font-size:22px;font-weight:bold;letter-spacing:-0.5px;">PADELPOINT</div>
            <div style="color:#9aa3b2;font-size:13px;margin-top:4px;">Muscat Arena · مسقط</div>
        </td>
    </tr>

    <tr>
        <td style="padding:30px 32px 8px;">
            <div dir="rtl" style="text-align:right;font-size:19px;font-weight:bold;color:#0b1326;">تم تأكيد حجزك</div>
            <div dir="rtl" style="text-align:right;font-size:14px;color:#5b6472;margin-top:6px;line-height:1.7;">
                احتفظ بالرقم المرجعي — تحتاجه للاطلاع على حجزك أو إلغائه.
            </div>
            <div style="font-size:19px;font-weight:bold;color:#0b1326;margin-top:22px;">Your booking is confirmed</div>
            <div style="font-size:14px;color:#5b6472;margin-top:6px;line-height:1.7;">
                Keep this reference code — you'll need it to view or cancel your booking.
            </div>
        </td>
    </tr>

    <tr>
        <td style="padding:22px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;border-radius:10px;">
                <tr><td align="center" style="padding:20px;">
                    <div style="font-size:12px;color:#5b6472;letter-spacing:1px;">REFERENCE · الرقم المرجعي</div>
                    <div style="font-size:30px;font-weight:bold;color:#0b1326;font-family:'Courier New',monospace;margin-top:6px;">{{ $booking->reference_code }}</div>
                </td></tr>
            </table>
        </td>
    </tr>

    <tr>
        <td style="padding:24px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#0b1326;">
                <tr>
                    <td style="padding:9px 0;border-bottom:1px solid #eaecef;color:#5b6472;">Date · التاريخ</td>
                    <td align="right" style="padding:9px 0;border-bottom:1px solid #eaecef;font-weight:bold;">{{ $dateLabel }}</td>
                </tr>
                @if ($first && $last)
                <tr>
                    <td style="padding:9px 0;border-bottom:1px solid #eaecef;color:#5b6472;">Time · الوقت</td>
                    <td align="right" style="padding:9px 0;border-bottom:1px solid #eaecef;font-weight:bold;">{{ substr($first->start_time, 0, 5) }} – {{ substr($last->end_time, 0, 5) }}</td>
                </tr>
                @endif
                <tr>
                    <td style="padding:9px 0;border-bottom:1px solid #eaecef;color:#5b6472;">Duration · المدة</td>
                    <td align="right" style="padding:9px 0;border-bottom:1px solid #eaecef;font-weight:bold;">{{ (int) $booking->total_duration_hours }} hr</td>
                </tr>
                <tr>
                    <td style="padding:9px 0;border-bottom:1px solid #eaecef;color:#5b6472;">Payment · الدفع</td>
                    <td align="right" style="padding:9px 0;border-bottom:1px solid #eaecef;font-weight:bold;">
                        {{ $paidOnline ? 'Paid online · مدفوع' : 'Pay at club · عند الحضور' }}
                    </td>
                </tr>
                <tr>
                    <td style="padding:13px 0;color:#5b6472;">Total · الإجمالي</td>
                    <td align="right" style="padding:13px 0;font-size:19px;font-weight:bold;">{{ number_format((float) $booking->total_amount, 2) }} {{ $booking->currency }}</td>
                </tr>
            </table>
        </td>
    </tr>

    <tr>
        <td align="center" style="padding:8px 32px 4px;">
            <a href="{{ $lookupUrl }}" style="display:inline-block;background:#c3f400;color:#0b1326;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 30px;border-radius:10px;">
                View my booking · عرض حجزي
            </a>
        </td>
    </tr>

    <tr>
        <td style="padding:20px 32px 30px;">
            <div style="font-size:12px;color:#5b6472;line-height:1.8;text-align:center;">
                Free cancellation up to 6 hours before your session.<br>
                <span dir="rtl">الإلغاء مجاني حتى 6 ساعات قبل موعد اللعب.</span>
            </div>
        </td>
    </tr>

    <tr>
        <td style="background:#f4f5f7;padding:18px 32px;">
            <div style="font-size:11px;color:#8a93a1;line-height:1.7;text-align:center;">
                Your court is assigned automatically on arrival.<br>
                <span dir="rtl">يُخصص لك الملعب تلقائياً عند الحضور.</span>
            </div>
        </td>
    </tr>

</table>
</td></tr>
</table>
</body>
</html>
