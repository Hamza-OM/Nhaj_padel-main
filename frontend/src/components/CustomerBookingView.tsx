import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Phone,
  Tag,
  AlertCircle,
  Ticket,
  Loader2
} from 'lucide-react';
import type {
  TimeSlotAvailability,
  CartSlotItem,
  PricingBreakdown,
  Booking,
  PaymentMethod
} from '../types';
import {
  fetchSlotAvailability,
  calculatePricingPreview,
  createBookingTransaction,
  createThawaniSession
} from '../services/api';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';
import { formatLocalDate } from '../utils/date';
import { ROUTES } from './Navbar';

const gridStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } }
};
const gridItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } }
};

export const CustomerBookingView: React.FC = () => {
  const { lang, currency } = useApp();
  const navigate = useNavigate();
  const t = translations[lang];

  // Date Management
  const todayStr = formatLocalDate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Slots & Loading
  const [slots, setSlots] = useState<TimeSlotAvailability[]>([]);
  const [totalActiveCourts, setTotalActiveCourts] = useState<number>(4);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cart State (Multi-slot / Multi-court support)
  const [cart, setCart] = useState<CartSlotItem[]>([]);

  // Customer Input Fields
  const [phone, setPhone] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('arrival');

  // Pricing Calculation Breakdown
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);

  // Booking & Modal States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // True while the browser is being handed over to Thawani's hosted checkout.
  const [redirectingToThawani, setRedirectingToThawani] = useState<boolean>(false);

  // Generate 14-day date picker options
  const dateOptions = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = formatLocalDate(d);
    const dayName = i === 0 ? t.today : i === 1 ? t.tomorrow : d.toLocaleDateString(lang === 'ar' ? 'ar-OM' : 'en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString(lang === 'ar' ? 'ar-OM' : 'en-US', { month: 'short' });
    return { dateStr, dayName, dayNum, monthName };
  });

  // Load slot availability function
  const loadSlots = (targetDate: string = selectedDate) => {
    setIsLoadingSlots(true);
    setErrorMsg(null);
    fetchSlotAvailability(targetDate)
      .then((data) => {
        setSlots(data.slots);
        setTotalActiveCourts(data.totalCourtsCount);
        setIsLoadingSlots(false);
      })
      .catch((err) => {
        setErrorMsg(err.message || t.errSlotsLoad);
        setIsLoadingSlots(false);
      });
  };

  // Load slot availability when selected date changes
  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate]);

  // Recalculate tiered pricing breakdown whenever cart total hours change
  useEffect(() => {
    const totalHours = cart.reduce((acc, item) => acc + item.quantity, 0);
    if (totalHours > 0) {
      calculatePricingPreview(totalHours)
        .then(setPricing)
        .catch(() => setPricing(null));
    } else {
      setPricing(null);
    }
  }, [cart]);

  // Cart Handlers
  const handleToggleSlotInCart = (slot: TimeSlotAvailability) => {
    if (!slot.isAvailable) return;

    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.date === selectedDate && ci.time === slot.time);
      if (existing) {
        return prevCart.filter((ci) => !(ci.date === selectedDate && ci.time === slot.time));
      } else {
        return [
          ...prevCart,
          {
            id: `${selectedDate}-${slot.time}`,
            date: selectedDate,
            time: slot.time,
            endTime: slot.endTime,
            quantity: 1
          }
        ];
      }
    });
  };

  const handleUpdateQuantity = (item: CartSlotItem, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((ci) => {
          if (ci.id === item.id) {
            const newQty = ci.quantity + delta;
            const slotData = slots.find((s) => s.time === ci.time);
            const maxAvailable = slotData ? slotData.availableCourtsCount : 4;

            if (newQty > maxAvailable) return ci;
            if (newQty <= 0) return null;
            return { ...ci, quantity: newQty };
          }
          return ci;
        })
        .filter(Boolean) as CartSlotItem[];
    });
  };

  // Phone validation helper
  const validatePhoneNum = (val: string) => {
    const clean = val.replace(/[\s\-\+\(\)]/g, '');
    if (!clean) {
      return lang === 'ar' ? 'رقم الهاتف مطلوب لمتابعة الحجز' : 'Phone number is required for booking.';
    }
    if (clean.length < 7 || !/^\d+$/.test(clean)) {
      return lang === 'ar' ? 'يرجى إدخال رقم هاتف صحيح (7 أرقام على الأقل)' : 'Please enter a valid phone number (at least 7 digits).';
    }
    return null;
  };

  const handlePhoneInputChange = (val: string) => {
    setPhone(val);
    if (phoneError) {
      setPhoneError(validatePhoneNum(val));
    }
  };

  // Checkout Handler
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      setErrorMsg(t.cartEmpty);
      return;
    }

    const pErr = validatePhoneNum(phone);
    if (pErr) {
      setPhoneError(pErr);
      const phoneEl = document.getElementById('customer-phone-input');
      if (phoneEl) {
        phoneEl.focus();
        phoneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setPhoneError(null);
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createBookingTransaction({
        customerPhone: phone.trim(),
        customerName: name ? name.trim() : undefined,
        customerEmail: email ? email.trim() : undefined,
        paymentMethod,
        cartItems: cart
      });

      loadSlots(selectedDate);

      if (paymentMethod === 'thawani') {
        // Hand the customer over to Thawani's hosted checkout. The booking is
        // held as pending_payment until Thawani tells our backend it was paid —
        // leaving this page is not, and must never be, proof of payment.
        const session = await createThawaniSession(res.booking.id);
        setRedirectingToThawani(true);
        window.location.href = session.paymentUrl;
        return;
      }

      setConfirmedBooking(res.booking);
    } catch (err: any) {
      setErrorMsg(err.message || t.errBookingFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCartHours = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner & Value Proposition */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-panel rounded-3xl p-6 sm:p-8 text-on-surface relative overflow-hidden border-t border-t-white/15"
      >
        {/* Background photo: padel rackets & balls on court (Vincenzo Morelli / Unsplash License) */}
        <div className="absolute inset-0 z-0">
          <div
            className="w-full h-full bg-cover mix-blend-luminosity opacity-60"
            style={{ backgroundImage: "url('/images/booking-hero.jpg')", backgroundPosition: 'left center' }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-surface/10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-surface/80 via-surface/35 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 glass-panel border-primary-container/30 px-3.5 py-1 rounded-full text-xs font-bold text-primary-container">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(195,244,0,0.8)]"></span>
            <span>{t.poolBadge}</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold italic tracking-tight text-primary leading-[1.05]">
            {t.heroTitle}
          </h1>
          <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
            {t.heroSubtitle}
          </p>
        </div>
      </motion.div>

      {/* Main Grid: Slot Selection vs Cart Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Date & Anonymous Slots Grid (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Date Selector Strip */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <CalendarIcon className="w-5 h-5 text-primary-container" />
                <span>{t.selectDate}</span>
              </div>
              <span className="text-xs text-on-surface-variant font-medium">{t.advanceBooking14Days}</span>
            </div>

            <motion.div
              variants={gridStagger}
              initial="hidden"
              animate="show"
              className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none"
            >
              {dateOptions.map((opt) => {
                const isSelected = selectedDate === opt.dateStr;
                return (
                  <motion.button
                    key={opt.dateStr}
                    variants={gridItem}
                    onClick={() => setSelectedDate(opt.dateStr)}
                    className={`relative flex-none w-24 h-22 rounded-2xl flex flex-col items-center justify-center cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'text-primary font-bold'
                        : 'bg-surface-container-low border border-white/5 text-on-surface-variant hover:border-primary-container/40'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="date-pill"
                        className="absolute inset-0 rounded-2xl bg-surface-container-high border-2 border-primary-container neon-glow -z-10"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className={`text-xs font-bold uppercase tracking-widest ${isSelected ? 'text-primary-container' : 'text-on-surface-variant'}`}>
                      {opt.dayName}
                    </span>
                    <span className="font-heading text-2xl font-bold text-primary my-0.5">{opt.dayNum}</span>
                    <span className="text-[10px] text-on-surface-variant">{opt.monthName}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* Tiered Offer Banner */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-on-surface border-t border-t-white/15">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary-container text-secondary-fixed flex items-center justify-center shrink-0 font-bold">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-primary">{t.ratesMatrixTitle}</h4>
                <p className="text-xs text-on-surface-variant">
                  {t.rate1hrBadge}: <span className="text-primary font-bold">10 {currency}/{t.hourShort}</span> | {t.rate2hrBadge}:{' '}
                  <span className="text-primary-container font-bold">8 {currency}/{t.hourShort} ({t.save20})</span> | {t.rate3hrBadge}:{' '}
                  <span className="text-primary-container font-bold">7 {currency}/{t.hourShort} ({t.save30})</span>
                </p>
              </div>
            </div>
            <span className="text-xs bg-surface-container-high text-primary-container border border-primary-container/20 px-3 py-1 rounded-full font-bold shrink-0">
              {lang === 'ar' ? 'خصم تلقائي' : 'Auto-Calculated'}
            </span>
          </div>

          {/* Slots Availability Section */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5 border-t border-t-white/15">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <h3 className="font-heading text-xl font-bold text-primary flex items-center gap-2">
                  <span>{lang === 'ar' ? 'أوقات وحصص الملعب' : 'Court Slots Availability'}</span>
                  <span className="font-sans bg-surface-container-high text-on-surface-variant text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    {selectedDate}
                  </span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {lang === 'ar' ? 'مسبح الملاعب الـ 8 المباشر (يتم تخصيص الملعب عشوائياً عند تأكيد الحجز).' : 'Managed via 8-Court Venue Pool (Court auto-assigned randomly upon confirmation).'}
                </p>

                {/* Court breakdown badge */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] bg-surface-container-high border border-white/10 text-on-surface-variant px-2.5 py-1 rounded-md font-semibold">
                    {lang === 'ar' ? '8 ملاعب عشبية احترافية متطابقة' : '8 Identical Professional Padel Courts'}
                  </span>
                  <span className="text-[10px] bg-primary-container/10 border border-primary-container/20 text-primary-container px-2 py-1 rounded-md font-medium flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    {lang === 'ar' ? 'تخصيص آلي عشوائي' : 'Auto-Assigned Random Allocation'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-surface-container-high border border-white/10"></span> {t.legendAvailable}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary-container"></span> {t.legendSelected}
                </div>
              </div>
            </div>

            {isLoadingSlots ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" aria-label={t.loadingSlots}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-5 rounded-2xl border border-white/10 bg-surface-container-low space-y-3 animate-pulse">
                    <div className="h-3 w-10 bg-surface-container-high rounded" />
                    <div className="h-5 w-16 bg-surface-container-high rounded" />
                    <div className="h-3 w-20 bg-surface-container-high rounded" />
                  </div>
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant">{t.noSlotsForDate}</div>
            ) : (
              <motion.div
                key={selectedDate}
                variants={gridStagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
              >
                {slots.map((slot) => {
                  const inCart = cart.some((ci) => ci.date === selectedDate && ci.time === slot.time);

                  return (
                    <motion.button
                      key={slot.time}
                      variants={gridItem}
                      disabled={!slot.isAvailable}
                      onClick={() => handleToggleSlotInCart(slot)}
                      whileTap={slot.isAvailable ? { scale: 0.98 } : undefined}
                      className={`relative p-5 rounded-2xl text-start transition-colors cursor-pointer overflow-hidden group border-t border-t-white/15 ${
                        inCart
                          ? 'border-2 border-primary-container bg-primary-container/10 text-on-surface neon-glow'
                          : slot.isAvailable
                          ? 'glass-panel neon-glow-hover text-on-surface'
                          : 'bg-surface-container-lowest border border-white/5 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      {slot.isAvailable && !inCart && (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-container/10 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary-container/25 transition-colors"></div>
                      )}
                      <div className="relative z-10 flex items-center justify-between w-full">
                        <span className={`text-xs font-bold uppercase ${inCart ? 'text-primary-container' : 'text-on-surface-variant'}`}>
                          {slot.time}
                        </span>
                        {inCart && <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />}
                      </div>

                      <div className="relative z-10 font-heading text-2xl font-bold mt-1 text-primary">60 {lang === 'ar' ? 'دقيقة' : 'Mins'}</div>

                      <div className="relative z-10 text-xs mt-1">
                        {slot.isAvailable ? (
                          <span className={inCart ? 'text-primary-container font-bold' : 'text-on-surface-variant'}>
                            {slot.availableCourtsCount} {t.courtsAvailable}
                          </span>
                        ) : (
                          <span className="text-error font-semibold">{t.slotFull}</span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Column: Cart & Booking Checkout Form (4 Cols) */}
        <div id="checkout-cart-section" className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 border-t border-t-white/15">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-heading text-2xl font-bold text-primary">{t.cartTitle}</h2>
              <span className="bg-primary-container text-on-primary-container text-xs px-3 py-1 rounded-full font-black">
                {cart.length} {cart.length === 1 ? t.slotSingular : t.slotPlural}
              </span>
            </div>

            {/* Selected Cart Items */}
            {cart.length === 0 ? (
              <div className="py-10 text-center space-y-3 text-on-surface-variant">
                <Clock className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm font-medium">{t.cartEmpty}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {cart.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 16, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                        exit={{ opacity: 0, x: 16, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-4 rounded-xl bg-surface-container-high/60 border border-white/5 flex items-start justify-between text-xs overflow-hidden"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold text-primary">{item.date}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {item.time} - {item.endTime} (1 {t.hourShort})
                          </p>
                          <div className="mt-2 inline-block px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-bold uppercase text-on-surface-variant">
                            {lang === 'ar' ? 'مسبح الملاعب' : 'Standard Pool'}
                          </div>
                        </div>

                        {/* Multi-court Quantity Controls */}
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-white/10 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item, -1)}
                              className="h-6 w-6 rounded bg-surface-container-high text-on-surface hover:bg-surface-bright flex items-center justify-center font-bold cursor-pointer transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-primary px-1 text-xs">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item, 1)}
                              className="h-6 w-6 rounded bg-surface-container-high text-on-surface hover:bg-surface-bright flex items-center justify-center font-bold cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item, -item.quantity)}
                            className="text-error hover:opacity-80 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{t.remove}</span>
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Pricing Summary */}
                <AnimatePresence>
                  {pricing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="bg-surface-container-high/60 border border-white/5 rounded-2xl p-4 space-y-2 text-xs overflow-hidden"
                    >
                      <div className="flex justify-between text-on-surface-variant">
                        <span>{t.totalDuration}:</span>
                        <span className="font-semibold text-primary">{pricing.totalHours} {t.hoursShort}</span>
                      </div>
                      <div className="flex justify-between text-on-surface-variant">
                        <span>{t.baseRate}:</span>
                        <span className="font-mono text-primary">{pricing.subtotal.toFixed(2)} {currency}</span>
                      </div>

                      {pricing.discountAmount > 0 && (
                        <div className="flex justify-between text-primary-container font-bold bg-primary-container/10 p-2 rounded-xl border border-primary-container/20">
                          <span>{t.durationDiscount}:</span>
                          <span className="font-mono">-{pricing.discountAmount.toFixed(2)} {currency}</span>
                        </div>
                      )}

                      <div className="border-t border-white/10 pt-3 flex justify-between items-center text-sm font-bold">
                        <span className="text-on-surface-variant font-medium">{t.totalAmount}</span>
                        <span className="font-heading text-3xl font-bold text-primary">{pricing.finalTotal.toFixed(2)} <span className="font-sans text-xs font-bold">{currency}</span></span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Customer Checkout Form (Positioned down below cart breakdown) */}
                <form onSubmit={handleConfirmBooking} noValidate className="space-y-5 pt-6 border-t border-white/10">
                  {/* General / Booking Error Alert Banner (Positioned right inside checkout form) */}
                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="bg-error-container/20 border border-error/30 rounded-xl p-3.5 text-xs text-on-error-container flex items-center justify-between shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-error shrink-0" />
                          <span className="font-semibold">{errorMsg}</span>
                        </div>
                        <button type="button" onClick={() => setErrorMsg(null)} className="font-bold text-[10px] uppercase tracking-wider text-error hover:underline cursor-pointer ml-2">
                          {t.close}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container font-black text-[10px] flex items-center justify-center">2</span>
                        <span>{t.customerDetails}</span>
                      </h3>
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {lang === 'ar' ? 'معلومات الإتصال' : 'Contact Information'}
                      </span>
                    </div>

                    {/* Phone Number Field */}
                    <div className="space-y-1.5" id="customer-phone-container">
                      <div className="flex items-center justify-between">
                        <label htmlFor="customer-phone-input" className="block text-xs font-bold text-on-surface-variant">
                          {lang === 'ar' ? 'رقم الهاتف (مطلوب)' : 'Phone Number (Required)'} <span className="text-error">*</span>
                        </label>
                        {phoneError && (
                          <span className="text-[11px] font-extrabold text-on-error-container bg-error-container/30 px-2.5 py-0.5 rounded-md border border-error/30 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {lang === 'ar' ? 'مطلوب إدخال رقم هاتف صحيح' : 'Required / Invalid'}
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-on-surface-variant pointer-events-none">
                          <Phone className={`w-4 h-4 ${phoneError ? 'text-error' : 'text-primary-container'}`} />
                          <span className="text-xs font-mono font-bold text-on-surface-variant border-r border-white/10 pr-2">+968</span>
                        </div>
                        <input
                          id="customer-phone-input"
                          type="tel"
                          required
                          placeholder={t.phonePlaceholder}
                          value={phone}
                          onChange={(e) => handlePhoneInputChange(e.target.value)}
                          onBlur={() => {
                            if (phone.trim()) {
                              setPhoneError(validatePhoneNum(phone));
                            }
                          }}
                          className={`w-full pl-24 pr-4 py-3.5 bg-surface-container-high border rounded-xl text-sm font-medium text-on-surface outline-hidden transition-colors placeholder-on-surface-variant/60 ${
                            phoneError
                              ? 'border-error ring-2 ring-error/20'
                              : 'border-white/10 focus:border-primary-container focus:ring-2 focus:ring-primary-container/20'
                          }`}
                        />
                      </div>
                      {phoneError && (
                        <div className="p-2.5 bg-error-container/20 border border-error/30 rounded-xl text-xs font-bold text-on-error-container flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-error" />
                          <span>{phoneError}</span>
                        </div>
                      )}
                    </div>

                    {/* Customer Full Name */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant">
                        {lang === 'ar' ? 'الاسم الكامل (اختياري)' : 'Full Name (Optional)'}
                      </label>
                      <input
                        type="text"
                        placeholder={t.fullNamePlaceholder}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3.5 bg-surface-container-high border border-white/10 rounded-xl text-sm font-medium text-on-surface outline-hidden focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-colors placeholder-on-surface-variant/60"
                      />
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface-variant">
                        {lang === 'ar' ? 'البريد الإلكتروني (اختياري)' : 'Email Address (Optional)'}
                      </label>
                      <input
                        type="email"
                        placeholder={t.emailPlaceholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3.5 bg-surface-container-high border border-white/10 rounded-xl text-sm font-medium text-on-surface outline-hidden focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-colors placeholder-on-surface-variant/60"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container font-black text-[10px] flex items-center justify-center">3</span>
                        <span>{t.paymentMethodTitle}</span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('arrival')}
                        className={`py-3.5 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                          paymentMethod === 'arrival'
                            ? 'border-2 border-primary-container bg-primary-container/10 text-on-surface'
                            : 'border border-white/10 bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        <span>{t.payOnArrival}</span>
                        <span className="text-[10px] opacity-75 font-normal">{t.payOnArrivalDesc}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('thawani')}
                        className={`py-3.5 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                          paymentMethod === 'thawani'
                            ? 'border-2 border-primary-container bg-primary-container/10 text-on-surface'
                            : 'border border-white/10 bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        <span>{t.thawaniOnline}</span>
                        <span className="text-[10px] opacity-75 font-normal">{t.thawaniOnlineDesc}</span>
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={!isSubmitting ? { scale: 1.01 } : undefined}
                    whileTap={!isSubmitting ? { scale: 0.98 } : undefined}
                    className="w-full py-4 bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container rounded-2xl font-black text-base transition-colors flex items-center justify-center gap-2 neon-glow neon-glow-hover disabled:opacity-50 mt-4 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>{t.reservingCourt}</span>
                    ) : (
                      <>
                        <span>{paymentMethod === 'thawani' ? t.proceedThawaniBtn : t.confirmBookingBtn}</span>
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                  <p className="text-[10px] text-on-surface-variant text-center mt-2">{t.termsNote}</p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal Ticket */}
      <AnimatePresence>
        {confirmedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/70 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="glass-panel rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-on-surface p-8 space-y-6 border-t border-t-white/15"
            >
              {confirmedBooking.paymentStatus === 'failed' ? (
                <div className="text-center space-y-2">
                  <div className="h-14 w-14 rounded-2xl bg-error-container/40 text-error flex items-center justify-center mx-auto font-black shadow-md">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="font-heading text-3xl font-bold text-primary">
                    {lang === 'ar' ? 'فشلت عملية الدفع' : 'Payment Failed'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {lang === 'ar'
                      ? 'تعذر إتمام الدفع. تم إلغاء هذا الحجز وتحرير الملعب مرة أخرى — لم يتم خصم أي مبلغ.'
                      : 'Your payment could not be completed. This booking has been cancelled and the slot released back to the pool — nothing was charged.'}
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="h-14 w-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto font-black neon-glow">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="font-heading text-3xl font-bold text-primary">{t.bookingConfirmedTitle}</h3>
                  <p className="text-xs text-on-surface-variant">
                    {lang === 'ar' ? 'تم تخصيص ملعبي الباديل الخاص بك من مسبح الملاعب.' : 'Your court has been randomly assigned behind the scenes.'}
                  </p>
                </div>
              )}

              <div className="bg-surface-container-high/60 border border-white/10 rounded-2xl p-5 space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-on-surface-variant font-sans">{t.bookingReference}:</span>
                  <span className="text-primary font-bold text-sm">{confirmedBooking.referenceCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-sans">{t.phone}:</span>
                  <span className="text-on-surface">{confirmedBooking.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-sans">{t.paymentMethodTitle}:</span>
                  <span className="text-on-surface">{confirmedBooking.paymentMethod === 'arrival' ? t.payOnArrival : t.thawaniOnline}</span>
                </div>

                {/* Session times only — which physical court you're allocated is
                    handled internally and deliberately not shown. */}
                <div className="pt-2 border-t border-white/10 space-y-1.5 font-sans">
                  <span className="text-on-surface-variant text-[11px] block font-semibold">{t.yourSessions}:</span>
                  {confirmedBooking.assignedSlots.map((slot, idx) => (
                    <div key={idx} className="bg-surface-container-lowest p-2.5 rounded-xl border border-white/10 flex justify-between text-xs">
                      <span className="text-primary font-bold font-mono">{slot.slotTime}–{slot.endTime}</span>
                      <span className="text-on-surface-variant font-mono">{slot.date}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-3 flex justify-between text-sm font-bold font-sans">
                  <span className="text-on-surface-variant">{t.totalAmount}:</span>
                  <span className="text-primary font-black text-lg">{confirmedBooking.totalAmount.toFixed(2)} {currency}</span>
                </div>
              </div>

              {confirmedBooking.paymentStatus !== 'failed' && (
                <p className="text-[11px] text-on-surface-variant text-center leading-relaxed -mt-2">
                  {t.saveReferenceHint}
                </p>
              )}

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setConfirmedBooking(null);
                    if (confirmedBooking.paymentStatus !== 'failed') {
                      setCart([]);
                    }
                    loadSlots(selectedDate);
                  }}
                  className="w-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-4 rounded-2xl transition-colors neon-glow cursor-pointer"
                >
                  {confirmedBooking.paymentStatus === 'failed'
                    ? (lang === 'ar' ? 'المحاولة مرة أخرى' : 'Try Again')
                    : t.bookAnother}
                </button>

                {confirmedBooking.paymentStatus !== 'failed' && (
                  <button
                    onClick={() => {
                      // Hand the reference/phone over via router state rather than the
                      // URL — a phone number has no business sitting in a query string.
                      navigate(ROUTES.myBooking, {
                        state: {
                          reference: confirmedBooking.referenceCode,
                          phone: confirmedBooking.customerPhone
                        }
                      });
                      setConfirmedBooking(null);
                      setCart([]);
                    }}
                    className="w-full glass-panel text-on-surface hover:text-primary-container hover:bg-white/10 font-bold py-3 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Ticket className="w-4 h-4 text-primary-container" />
                    <span>{t.viewMyBookingBtn}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Floating Cart Bar */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed bottom-4 left-4 right-4 z-40 lg:hidden glass-panel text-on-surface p-4 rounded-2xl shadow-2xl flex items-center justify-between border-t border-t-white/15"
          >
            <div>
              <div className="text-[11px] opacity-80 uppercase font-bold tracking-wider">
                {totalCartHours} {lang === 'ar' ? 'حصص مختارة' : 'Slots Selected'}
              </div>
              <div className="text-lg font-black font-mono">
                {pricing ? pricing.finalTotal.toFixed(2) : (totalCartHours * 10).toFixed(2)} {currency}
              </div>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('checkout-cart-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer neon-glow"
            >
              <span>{lang === 'ar' ? 'متابعة الحجز' : 'Proceed to Checkout'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handing over to Thawani's hosted checkout */}
      <AnimatePresence>
        {redirectingToThawani && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/80 backdrop-blur-2xl"
          >
            <div className="glass-panel rounded-3xl p-10 text-center space-y-4 border-t border-t-white/15 max-w-sm">
              <Loader2 className="w-10 h-10 text-primary-container animate-spin mx-auto" />
              <h3 className="font-heading text-2xl font-bold text-primary">{t.redirectingTitle}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">{t.redirectingBody}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
