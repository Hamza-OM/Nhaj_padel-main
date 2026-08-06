import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2, Calendar, Ticket } from 'lucide-react';
import type { PaymentResultResponse } from '../types';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';
import { fetchPaymentResult } from '../services/api';
import { ROUTES } from './Navbar';

/**
 * Where Thawani drops the customer after checkout.
 *
 * The URL says nothing trustworthy about the payment — even the "cancelled"
 * flag is only a hint for what to show while loading. The real verdict comes
 * from Laravel, which re-checks the session with Thawani before answering.
 */
export const PaymentResultView: React.FC = () => {
  const { lang, currency } = useApp();
  const t = translations[lang];
  const [params] = useSearchParams();

  const reference = params.get('ref') ?? '';
  const cameFromCancel = params.get('cancelled') === '1';

  const [result, setResult] = useState<PaymentResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!reference) {
      setError(t.payResultMissingRef);
      setIsLoading(false);
      return;
    }

    fetchPaymentResult(reference)
      .then((res) => { if (active) setResult(res); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : t.payResultError); })
      .finally(() => { if (active) setIsLoading(false); });

    return () => { active = false; };
  }, [reference, t.payResultMissingRef, t.payResultError]);

  const booking = result?.booking;
  const status = result?.paymentStatus;

  const isPaid = status === 'paid';
  const isPending = status === 'pending';
  const isNegative = status === 'cancelled' || status === 'expired' || status === 'failed';

  const heading = isPaid
    ? t.payResultPaidTitle
    : isPending
      ? (cameFromCancel ? t.payResultCancelledTitle : t.payResultPendingTitle)
      : status === 'expired'
        ? t.payResultExpiredTitle
        : status === 'cancelled'
          ? t.payResultCancelledTitle
          : t.payResultFailedTitle;

  const body = isPaid
    ? t.payResultPaidBody
    : isPending
      ? (cameFromCancel ? t.payResultCancelledBody : t.payResultPendingBody)
      : status === 'expired'
        ? t.payResultExpiredBody
        : status === 'cancelled'
          ? t.payResultCancelledBody
          : t.payResultFailedBody;

  return (
    <div className="pb-16 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="glass-panel rounded-3xl border-t border-t-white/15 overflow-hidden"
      >
        {isLoading ? (
          <div className="p-12 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-8 h-8 text-primary-container animate-spin" />
            <p className="text-sm text-on-surface-variant">{t.payResultVerifying}</p>
          </div>
        ) : error ? (
          <div className="p-10 space-y-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-error-container/40 text-error flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-primary">{t.payResultError}</h1>
            <p className="text-xs text-on-surface-variant">{error}</p>
            <Link
              to={ROUTES.book}
              className="inline-flex items-center gap-2 bg-primary-container text-on-primary-container font-bold px-6 py-3 rounded-2xl text-sm neon-glow"
            >
              {t.payResultBackToBooking}
            </Link>
          </div>
        ) : (
          <>
            {/* Status header */}
            <div
              className={`px-8 py-10 text-center space-y-3 border-b border-white/10 ${
                isPaid ? 'bg-primary-container/10' : isNegative ? 'bg-error-container/15' : 'bg-surface-container-high/50'
              }`}
            >
              <div
                className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto ${
                  isPaid
                    ? 'bg-primary-container text-on-primary-container neon-glow'
                    : isNegative
                      ? 'bg-error-container/40 text-error'
                      : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {isPaid ? <CheckCircle2 className="w-9 h-9" /> : isNegative ? <XCircle className="w-9 h-9" /> : <Clock className="w-9 h-9" />}
              </div>
              <h1 className="font-heading text-4xl font-extrabold italic text-primary leading-tight">{heading}</h1>
              <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">{body}</p>
            </div>

            {/* Booking details — no physical court, by design */}
            {booking && (
              <div className="p-6 sm:p-8 space-y-5">
                <div className="bg-surface-container-high/60 border border-white/10 rounded-2xl p-5 space-y-3 text-xs">
                  <div className="flex justify-between border-b border-white/10 pb-2.5">
                    <span className="text-on-surface-variant">{t.bookingReference}:</span>
                    <span className="text-primary font-mono font-black text-sm">{booking.referenceCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">{t.payResultDate}:</span>
                    <span className="text-on-surface">{booking.bookingDate}</span>
                  </div>
                  {booking.assignedSlots.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">{t.payResultTime}:</span>
                      <span className="text-on-surface font-mono">
                        {booking.assignedSlots[0].slotTime} – {booking.assignedSlots[booking.assignedSlots.length - 1].endTime}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">{t.payResultDuration}:</span>
                    <span className="text-on-surface">
                      {booking.totalDurationHours} {booking.totalDurationHours === 1 ? t.hourShort : t.hoursShort}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">{t.paymentMethodTitle}:</span>
                    <span className="text-on-surface">
                      {isPaid ? t.payResultPaidOnline : t.payResultOnlinePayment}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-3 font-bold">
                    <span className="text-on-surface-variant">{t.totalAmount}:</span>
                    <span className="text-primary font-black text-lg">
                      {booking.totalAmount.toFixed(2)} {currency}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {isPaid ? (
                    <Link
                      to={ROUTES.myBooking}
                      className="w-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-4 rounded-2xl text-sm transition-colors neon-glow flex items-center justify-center gap-2"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>{t.viewMyBookingBtn}</span>
                    </Link>
                  ) : (
                    <>
                      <Link
                        to={ROUTES.book}
                        className="w-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-4 rounded-2xl text-sm transition-colors neon-glow flex items-center justify-center gap-2"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>{t.payResultTryAgain}</span>
                      </Link>
                      <Link
                        to={ROUTES.book}
                        className="w-full glass-panel text-on-surface hover:text-primary-container hover:bg-white/10 font-bold py-3 rounded-2xl text-xs transition-colors flex items-center justify-center"
                      >
                        {t.payResultOtherMethod}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};
