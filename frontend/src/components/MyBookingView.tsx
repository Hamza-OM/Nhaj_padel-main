import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { Search, Ticket, AlertCircle, CheckCircle2, XCircle, CalendarClock, ShieldCheck } from 'lucide-react';
import type { Booking } from '../types';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';
import { lookupBooking, cancelCustomerBooking } from '../services/api';

/** Optional handoff from the post-booking confirmation modal. */
interface LookupHandoff {
  reference?: string;
  phone?: string;
}

export const MyBookingView: React.FC = () => {
  const { lang, currency } = useApp();
  const t = translations[lang];
  const handoff = (useLocation().state ?? null) as LookupHandoff | null;

  const [reference, setReference] = useState(handoff?.reference ?? '');
  const [phone, setPhone] = useState(handoff?.phone ?? '');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [cancellationWindowHours, setCancellationWindowHours] = useState<number>(6);

  const [isSearching, setIsSearching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const runLookup = useCallback(async (ref: string, ph: string) => {
    if (!ref.trim() || !ph.trim()) return;

    setIsSearching(true);
    setError(null);
    setCancelError(null);
    setBooking(null);

    try {
      const res = await lookupBooking(ref.trim(), ph.trim());
      setBooking(res.booking);
      setCancellationWindowHours(res.cancellationWindowHours ?? 6);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.myBookingNotFound);
    } finally {
      setIsSearching(false);
    }
  }, [t.myBookingNotFound]);

  // Arriving straight from the booking confirmation — load it without making the
  // customer retype what they just entered.
  useEffect(() => {
    if (handoff?.reference && handoff?.phone) {
      runLookup(handoff.reference, handoff.phone);
    }
    // Intentionally mount-only: re-running on handoff identity would re-fetch
    // after the customer cancels and the component re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runLookup(reference, phone);
  };

  const handleCancel = async () => {
    if (!booking) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await cancelCustomerBooking(reference.trim(), phone.trim());
      setBooking(res.booking);
      setShowCancelConfirm(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel this booking');
      setShowCancelConfirm(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const resetSearch = () => {
    setBooking(null);
    setReference('');
    setPhone('');
    setError(null);
    setCancelError(null);
  };

  const isCancelled = booking?.bookingStatus === 'cancelled';
  const isCompleted = booking?.bookingStatus === 'completed';
  const canCancel = booking && !isCancelled && !isCompleted;

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-panel rounded-3xl p-8 sm:p-12 border-t border-t-white/15"
      >
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 glass-panel border-primary-container/30 px-3.5 py-1 rounded-full text-xs font-extrabold text-primary-container">
            <Ticket className="w-3.5 h-3.5" />
            <span>{t.navMyBooking}</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-6xl font-extrabold italic tracking-tight text-primary leading-[1.05]">
            {t.myBookingTitle}
          </h1>
          <p className="text-on-surface-variant text-base leading-relaxed">{t.myBookingSubtitle}</p>
        </div>
      </motion.div>

      {/* Search Form */}
      <motion.form
        onSubmit={handleSearch}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5 border-t border-t-white/15"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant">{t.myBookingRefLabel}</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t.myBookingRefPlaceholder}
              className="w-full bg-surface-container-high border border-white/10 rounded-2xl px-4 py-3 text-sm text-on-surface font-mono placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant">{t.myBookingPhoneLabel}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              className="w-full bg-surface-container-high border border-white/10 rounded-2xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container transition-colors"
            />
          </div>
        </div>

        <motion.button
          type="submit"
          whileHover={!isSearching ? { scale: 1.01 } : undefined}
          whileTap={!isSearching ? { scale: 0.99 } : undefined}
          disabled={isSearching || !reference.trim() || !phone.trim()}
          className="w-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-black py-4 rounded-2xl text-sm transition-colors neon-glow neon-glow-hover flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>{isSearching ? t.myBookingSearching : t.myBookingSearchBtn}</span>
        </motion.button>

        <p className="flex items-center gap-2 text-[11px] text-on-surface-variant">
          <ShieldCheck className="w-3.5 h-3.5 text-primary-container shrink-0" />
          <span>{t.myBookingPolicyNote.replace('{hours}', String(cancellationWindowHours))}</span>
        </p>
      </motion.form>

      {/* Not found / error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-panel border border-error/30 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-variant">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence mode="wait">
        {booking && (
          <motion.div
            key={booking.referenceCode + booking.bookingStatus}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="glass-panel rounded-3xl overflow-hidden border-t border-t-white/15"
          >
            {/* Status banner */}
            <div
              className={`px-6 py-4 flex items-center gap-3 border-b border-white/10 ${
                isCancelled ? 'bg-error-container/20' : isCompleted ? 'bg-surface-container-high/60' : 'bg-primary-container/10'
              }`}
            >
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isCancelled
                    ? 'bg-error-container/40 text-error'
                    : isCompleted
                      ? 'bg-surface-container-highest text-on-surface-variant'
                      : 'bg-primary-container text-on-primary-container neon-glow'
                }`}
              >
                {isCancelled ? (
                  <XCircle className="w-5 h-5" />
                ) : isCompleted ? (
                  <CalendarClock className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="font-mono font-black text-lg text-primary leading-tight">{booking.referenceCode}</div>
                <div className="text-xs text-on-surface-variant">
                  {isCancelled
                    ? t.myBookingCancelledNotice
                    : isCompleted
                      ? t.myBookingCompletedNotice
                      : `${booking.totalDurationHours} ${booking.totalDurationHours === 1 ? t.hourShort : t.hoursShort} · ${booking.bookingDate}`}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Summary rows */}
              <div className="bg-surface-container-high/60 border border-white/10 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{t.phone}:</span>
                  <span className="text-on-surface font-mono">{booking.customerPhone}</span>
                </div>
                {booking.customerName && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">{t.fullName}:</span>
                    <span className="text-on-surface">{booking.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{t.paymentMethodTitle}:</span>
                  <span className="text-on-surface capitalize">{booking.paymentMethod}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2.5 font-bold">
                  <span className="text-on-surface-variant">{t.totalAmount}:</span>
                  <span className="text-primary font-black text-base">
                    {booking.totalAmount.toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              {/* Sessions */}
              {!isCancelled && booking.assignedSlots.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-on-surface-variant block">{t.myBookingSessionsTitle}</span>
                  {booking.assignedSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-container-lowest p-3 rounded-xl border border-white/10 flex justify-between items-center text-xs"
                    >
                      <span className="text-primary font-bold font-mono">{slot.slotTime}–{slot.endTime}</span>
                      <span className="text-on-surface-variant font-mono">{slot.date}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cancel error */}
              {cancelError && (
                <div className="glass-panel border border-error/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant">{cancelError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2.5">
                {canCancel && !showCancelConfirm && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full bg-surface-container-high hover:bg-error-container/20 text-error border border-white/10 font-bold py-3 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t.myBookingCancelBtn}</span>
                  </button>
                )}

                <AnimatePresence>
                  {showCancelConfirm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-error-container/15 border border-error/30 rounded-2xl p-4 space-y-3">
                        <div>
                          <p className="text-sm font-black text-error">{t.myBookingCancelConfirmTitle}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{t.myBookingCancelConfirmBody}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancel}
                            disabled={isCancelling}
                            className="flex-1 bg-error text-on-error font-bold py-2.5 rounded-xl text-xs transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                          >
                            {isCancelling ? t.myBookingCancelling : t.myBookingCancelConfirmYes}
                          </button>
                          <button
                            onClick={() => setShowCancelConfirm(false)}
                            disabled={isCancelling}
                            className="flex-1 glass-panel text-on-surface font-bold py-2.5 rounded-xl text-xs hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            {t.myBookingKeepIt}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={resetSearch}
                  className="w-full glass-panel text-on-surface-variant hover:text-primary font-bold py-3 rounded-2xl text-xs hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {t.myBookingSearchAnother}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
