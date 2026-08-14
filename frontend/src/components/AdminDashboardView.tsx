import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  CalendarOff,
  Filter,
  Plus,
  Trash2,
  Search,
  XCircle,
  RefreshCw,
  Tag,
  ShieldCheck
} from 'lucide-react';
import type { Court, CourtClosure, TieredPricingRule, Booking } from '../types';
import {
  fetchAdminCourts,
  createAdminCourt,
  updateAdminCourt,
  deleteAdminCourt,
  fetchAdminClosures,
  createAdminClosure,
  deleteAdminClosure,
  fetchAdminPricingRules,
  createAdminPricingRule,
  deleteAdminPricingRule,
  fetchAdminBookings,
  cancelAdminBooking,
  settleAdminBooking,
  adminLogin,
  adminLogout,
  verifyAdminSession,
  getAdminToken
} from '../services/api';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';
import { formatLocalDate } from '../utils/date';

const gridStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } }
};
const gridItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } }
};

const modalOverlay = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
  exit: { opacity: 0 }
};
const modalPanel = {
  hidden: { opacity: 0, scale: 0.94, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 340, damping: 28 } },
  exit: { opacity: 0, scale: 0.96, y: 6 }
};

export const AdminDashboardView: React.FC = () => {
  const { lang, currency } = useApp();
  const t = translations[lang];

  // Admin Authentication State
  // isVerifyingSession covers the brief window on mount where a stored token
  // (from an earlier login in this tab) is being checked against the server
  // before deciding whether to show the dashboard or the login screen — this
  // avoids trusting a token that may have expired or been revoked.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState<string>('admin@padel.com');
  const [loginPassword, setLoginPassword] = useState<string>('Demo-5e977ff12f8c');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'bookings' | 'courts' | 'closures' | 'pricing'>('bookings');

  // On mount, if this tab already has a session token, confirm the server
  // still honors it (rather than trusting sessionStorage's mere presence).
  useEffect(() => {
    if (!getAdminToken()) {
      setIsVerifyingSession(false);
      return;
    }
    verifyAdminSession()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsVerifyingSession(false));
  }, []);

  // Handle Login — a real server round-trip against a hashed password, not a
  // client-side string comparison.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await adminLogin(loginUsername.trim(), loginPassword);
      setIsAuthenticated(true);
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : lang === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'Invalid username or password.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    setIsAuthenticated(false);
  };

  // Data States
  const [courts, setCourts] = useState<Court[]>([]);
  const [closures, setClosures] = useState<CourtClosure[]>([]);
  const [pricingRules, setPricingRules] = useState<TieredPricingRule[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States for Bookings
  const [filterCourtId, setFilterCourtId] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [filterPhone, setFilterPhone] = useState<string>('');

  // Modal / Form States
  const [showAddCourt, setShowAddCourt] = useState<boolean>(false);
  const [courtForm, setCourtForm] = useState({ name: '', basePricePerHour: 10, openingTime: '07:00', closingTime: '23:00', surfaceType: 'Professional Padel Turf' });

  const [showAddClosure, setShowAddClosure] = useState<boolean>(false);
  const [closureForm, setClosureForm] = useState({ courtId: 'ALL', startDate: formatLocalDate(new Date()), endDate: formatLocalDate(new Date()), reason: 'Maintenance' });

  const [showAddRule, setShowAddRule] = useState<boolean>(false);
  const [ruleForm, setRuleForm] = useState({ minHours: 1, maxHours: 1, ratePerHour: 10, description: '' });

  // Confirmation Modal States
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [courtToDelete, setCourtToDelete] = useState<Court | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load All Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cRes, clRes, pRes, bRes] = await Promise.all([
        fetchAdminCourts(),
        fetchAdminClosures(),
        fetchAdminPricingRules(),
        fetchAdminBookings({
          courtId: filterCourtId,
          date: filterDate,
          status: filterStatus,
          paymentMethod: filterPayment,
          phone: filterPhone
        })
      ]);
      setCourts(cRes);
      setClosures(clRes);
      setPricingRules(pRes);
      setBookings(bRes);
    } catch (err) {
      console.error(err);
      // adminFetch already cleared the stored token if this was a 401 —
      // reflect that by bouncing back to the login screen instead of
      // sitting on a dashboard that can no longer actually load anything.
      if (!getAdminToken()) setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated, filterCourtId, filterDate, filterStatus, filterPayment, filterPhone]);

  // Handlers for Court
  const handleSaveCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createAdminCourt(courtForm);
      setShowAddCourt(false);
      setCourtForm({ name: '', basePricePerHour: 10, openingTime: '07:00', closingTime: '23:00', surfaceType: 'Professional Padel Turf' });
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleToggleCourtActive = async (court: Court) => {
    try {
      await updateAdminCourt(court.id, { isActive: !court.isActive });
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const executeDeleteCourt = async () => {
    if (!courtToDelete) return;
    setIsProcessingAction(true);
    setActionError(null);
    try {
      await deleteAdminCourt(courtToDelete.id);
      setCourtToDelete(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || t.errActionFailed);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handlers for Closures
  const handleSaveClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createAdminClosure(closureForm);
      setShowAddClosure(false);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteClosure = async (id: string) => {
    try {
      await deleteAdminClosure(id);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteAdminPricingRule(id);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Handlers for Pricing Rules
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createAdminPricingRule(ruleForm);
      setShowAddRule(false);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const executeCancelBooking = async () => {
    if (!bookingToCancel) return;
    setIsProcessingAction(true);
    setActionError(null);
    try {
      await cancelAdminBooking(bookingToCancel.id);
      setBookingToCancel(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || t.errActionFailed);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSettleBooking = async (booking: Booking, outcome: 'paid' | 'no_show') => {
    setActionError(null);
    try {
      await settleAdminBooking(booking.id, outcome);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || t.errActionFailed);
    }
  };

  // Calculate Metrics
  //
  // A booking's money is only real once payment_status is 'paid'. Counting
  // every non-cancelled booking as revenue overstates it badly: it sweeps in
  // pay-on-arrival bookings nobody has paid for yet, plus abandoned Thawani
  // checkouts (pending_payment) that will almost certainly never be paid.
  // Those three buckets are shown separately so the headline figure means
  // "money actually taken".
  const todayStr = formatLocalDate(new Date());

  const cancelledCount = bookings.filter((b) => b.bookingStatus === 'cancelled').length;
  const awaitingPaymentCount = bookings.filter((b) => b.bookingStatus === 'pending_payment').length;
  const activeBookingsCount = bookings.length - cancelledCount - awaitingPaymentCount;

  const liveBookings = bookings.filter(
    (b) => b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'pending_payment'
  );

  const revenueCollected = liveBookings
    .filter((b) => b.paymentStatus === 'paid')
    .reduce((acc, b) => acc + b.totalAmount, 0);

  // A no-show is recorded as a cancelled payment: the slot was held but no
  // money was ever due, so it belongs in neither bucket below.
  const unpaidLive = liveBookings.filter(
    (b) => b.paymentStatus !== 'paid' && b.paymentStatus !== 'cancelled'
  );

  // Still to come — the customer pays at reception on the day.
  const revenueExpected = unpaidLive
    .filter((b) => b.bookingDate >= todayStr)
    .reduce((acc, b) => acc + b.totalAmount, 0);

  // Sessions that already happened and were never settled at the counter.
  // Not "expected" in any meaningful sense — it's a reconciliation backlog.
  const unsettledBookings = unpaidLive.filter((b) => b.bookingDate < todayStr);
  const revenueUnsettled = unsettledBookings.reduce((acc, b) => acc + b.totalAmount, 0);

  // "Active" closures means currently in effect today, not the total ever created
  const activeClosuresCount = closures.filter((c) => c.startDate <= todayStr && c.endDate >= todayStr).length;

  // Filtered Bookings for Table
  const filteredBookings = bookings.filter((b) => {
    // 1. Court filter
    if (filterCourtId !== 'ALL') {
      const hasCourt = b.assignedSlots && b.assignedSlots.some((s) => s.courtId === filterCourtId);
      if (!hasCourt) return false;
    }

    // 2. Date filter (handles single date or multi-date bookings)
    if (filterDate) {
      const matchesDate =
        (b.bookingDate && b.bookingDate.includes(filterDate)) ||
        (b.assignedSlots && b.assignedSlots.some((s) => s.date === filterDate));
      if (!matchesDate) return false;
    }

    // 3. Status filter
    if (filterStatus !== 'ALL' && b.bookingStatus !== filterStatus) {
      return false;
    }

    // 4. Payment method filter
    if (filterPayment !== 'ALL' && b.paymentMethod !== filterPayment) {
      return false;
    }

    // 5. General Search query (Phone, Reference Code, Name, Email, Court Name, Slot Time, Date)
    if (filterPhone.trim()) {
      const query = filterPhone.trim().toLowerCase();
      const rawQuery = query.replace(/[\s\-\+\(\)]/g, '');

      const customerPhoneClean = (b.customerPhone || '').toLowerCase().replace(/[\s\-\+\(\)]/g, '');
      const matchPhone =
        (b.customerPhone && b.customerPhone.toLowerCase().includes(query)) ||
        (rawQuery.length > 0 && customerPhoneClean.includes(rawQuery));

      const matchRef = b.referenceCode ? b.referenceCode.toLowerCase().includes(query) : false;
      const matchName = b.customerName ? b.customerName.toLowerCase().includes(query) : false;
      const matchEmail = b.customerEmail ? b.customerEmail.toLowerCase().includes(query) : false;
      const matchDate = b.bookingDate ? b.bookingDate.toLowerCase().includes(query) : false;

      const matchSlots = b.assignedSlots
        ? b.assignedSlots.some((s) => {
            const cName = (s.courtName || '').toLowerCase();
            const sTime = (s.slotTime || '').toLowerCase();
            const sDate = (s.date || '').toLowerCase();
            return cName.includes(query) || sTime.includes(query) || sDate.includes(query);
          })
        : false;

      if (!matchPhone && !matchRef && !matchName && !matchEmail && !matchDate && !matchSlots) {
        return false;
      }
    }

    return true;
  });

  if (isVerifyingSession) {
    return (
      <div className="max-w-md mx-auto my-12 glass-panel rounded-3xl p-8 min-h-[520px] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-primary-container animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md mx-auto my-12 glass-panel rounded-3xl p-8 text-on-surface border-t border-t-white/15"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-primary-container rounded-2xl flex items-center justify-center text-on-primary-container mb-4 neon-glow">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-primary">
            {lang === 'ar' ? 'تسجيل دخول مدير النظام' : 'Admin Portal Login'}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            {lang === 'ar' ? 'يرجى إدخال بيانات الاعتماد للوصول إلى لوحة التحكم' : 'Enter admin credentials to access court management & analytics'}
          </p>
        </div>

        {/* Demo Credentials Hint Box */}
        <div className="mb-6 bg-surface-container-high/60 border border-white/10 rounded-2xl p-4 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">
              {lang === 'ar' ? 'بيانات الاعتماد التجريبية' : 'Demo Admin Credentials'}
            </span>
            <button
              type="button"
              onClick={() => {
                setLoginUsername('admin@padel.com');
                setLoginPassword('Demo-5e977ff12f8c');
                setLoginError(null);
              }}
              className="text-[11px] font-bold text-primary-container hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'تعبئة تلقائية' : 'Quick Fill'}
            </button>
          </div>
          <div className="space-y-1 font-mono text-on-surface-variant">
            <div><span className="opacity-70">{t.usernameLabel}:</span> <strong className="text-primary">admin@padel.com</strong></div>
            <div><span className="opacity-70">{t.passwordLabel}:</span> <strong className="text-primary">Demo-5e977ff12f8c</strong></div>
          </div>
        </div>

        {loginError && (
          <div className="mb-6 p-3.5 bg-error-container/20 border border-error/30 text-on-error-container text-xs rounded-xl font-medium flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0 text-error" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">
              {lang === 'ar' ? 'اسم المستخدم / البريد الإلكتروني' : 'Username / Email'}
            </label>
            <input
              type="text"
              required
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="admin@padel.com"
              className="w-full bg-surface-container-high border border-white/10 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-hidden focus:ring-2 focus:ring-primary-container/40"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">
              {lang === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-surface-container-high border border-white/10 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-hidden focus:ring-2 focus:ring-primary-container/40"
            />
          </div>

          <motion.button
            whileHover={!isLoggingIn ? { scale: 1.01 } : undefined}
            whileTap={!isLoggingIn ? { scale: 0.98 } : undefined}
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer mt-2 neon-glow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingIn
              ? (lang === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing In...')
              : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In to Admin Portal')}
          </motion.button>
        </form>
      </motion.div>
    );
  }

  const adminTabs: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'bookings', label: t.tabBookings, icon: <Filter className="w-4 h-4" /> },
    { id: 'courts', label: t.tabCourts, icon: <Building2 className="w-4 h-4" /> },
    { id: 'closures', label: t.tabClosures, icon: <CalendarOff className="w-4 h-4" /> },
    { id: 'pricing', label: t.tabPricing, icon: <Tag className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-panel rounded-3xl p-6 sm:p-8 text-on-surface border-t border-t-white/15"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-primary-container font-bold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{t.adminSubtitle}</span>
            </div>
            <h1 className="font-heading text-4xl font-bold text-primary tracking-tight">{t.adminTitle}</h1>
            <p className="text-on-surface-variant text-sm mt-1">
              {lang === 'ar' ? 'إدارة الملاعب، أوقات العمل، فترات الإغلاق، قواعد التسعير متدرج المدة والحجوزات.' : 'Manage physical courts, working hours, blackout date ranges, tiered duration pricing, and bookings.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={loadData}
              className="flex items-center gap-2 glass-panel hover:bg-white/10 px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t.refreshData}</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-error-container/20 hover:bg-error-container/30 border border-error/30 px-4 py-2.5 rounded-xl text-xs font-bold text-on-error-container transition-colors cursor-pointer"
              title={t.logoutTooltip}
            >
              <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
            </button>
          </div>
        </div>

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-surface-container-high/60 border border-white/5 rounded-2xl p-5">
            <span className="text-xs text-on-surface-variant font-semibold">{t.totalRevenue}</span>
            <div className="font-heading text-3xl font-bold text-primary-container mt-1">{revenueCollected.toFixed(2)} {currency}</div>
            {revenueExpected > 0 && (
              <div className="text-[11px] text-on-surface-variant mt-1">
                +{revenueExpected.toFixed(2)} {currency} {t.revenueExpected}
              </div>
            )}
            {revenueUnsettled > 0 && (
              <div className="text-[11px] text-amber-400 mt-0.5">
                {revenueUnsettled.toFixed(2)} {currency} {t.revenueUnsettled}
              </div>
            )}
          </div>
          <div className="bg-surface-container-high/60 border border-white/5 rounded-2xl p-5">
            <span className="text-xs text-on-surface-variant font-semibold">{t.activeCourts}</span>
            <div className="font-heading text-3xl font-bold text-primary mt-1">
              {courts.filter((c) => c.isActive).length} / {courts.length}
            </div>
          </div>
          <div className="bg-surface-container-high/60 border border-white/5 rounded-2xl p-5">
            <span className="text-xs text-on-surface-variant font-semibold">{t.totalBookings}</span>
            <div className="font-heading text-3xl font-bold text-primary mt-1">{activeBookingsCount}</div>
            {(cancelledCount > 0 || awaitingPaymentCount > 0) && (
              <div className="text-[11px] text-on-surface-variant mt-1">
                {cancelledCount > 0 && `${cancelledCount} ${t.bookingsCancelled}`}
                {cancelledCount > 0 && awaitingPaymentCount > 0 && ' · '}
                {awaitingPaymentCount > 0 && `${awaitingPaymentCount} ${t.bookingsAwaitingPayment}`}
              </div>
            )}
          </div>
          <div className="bg-surface-container-high/60 border border-white/5 rounded-2xl p-5">
            <span className="text-xs text-on-surface-variant font-semibold">{t.activeClosures}</span>
            <div className="font-heading text-3xl font-bold text-primary mt-1">{activeClosuresCount}</div>
          </div>
        </div>
      </motion.div>

      {/* Admin Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-6 overflow-x-auto text-sm font-bold">
        {adminTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-1 flex items-center gap-2 transition-colors cursor-pointer ${
                isActive ? 'text-primary font-black' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className={isActive ? 'text-primary-container' : ''}>{tab.icon}</span>
              <span>{tab.label}</span>
              {isActive && (
                <motion.span
                  layoutId="admin-tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary-container shadow-[0_0_8px_rgba(195,244,0,0.6)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BOOKINGS & FILTERS */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Multi-Filter Bar */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary-container" />
                  <span>{t.filterTitle}</span>
                </h3>
                <span className="text-xs bg-surface-container-high border border-white/10 text-on-surface-variant px-2.5 py-0.5 rounded-full font-semibold">
                  {lang === 'ar'
                    ? `عرض ${filteredBookings.length} من إجمالي ${bookings.length}`
                    : `Showing ${filteredBookings.length} of ${bookings.length}`}
                </span>
              </div>

              {(filterCourtId !== 'ALL' || filterDate || filterStatus !== 'ALL' || filterPayment !== 'ALL' || filterPhone) && (
                <button
                  onClick={() => {
                    setFilterCourtId('ALL');
                    setFilterDate('');
                    setFilterStatus('ALL');
                    setFilterPayment('ALL');
                    setFilterPhone('');
                  }}
                  className="text-xs text-error hover:underline font-bold cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t.resetFilters}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Filter: Court */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t.filterCourt}</label>
                <select
                  value={filterCourtId}
                  onChange={(e) => setFilterCourtId(e.target.value)}
                  className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-hidden focus:border-primary-container"
                >
                  <option value="ALL">{t.allCourts}</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter: Date */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t.filterDate}</label>
                <div className="relative">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-hidden focus:border-primary-container"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary text-xs"
                      title={t.clearFilter}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filter: Status */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t.filterStatus}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-hidden focus:border-primary-container"
                >
                  <option value="ALL">{t.allStatuses}</option>
                  <option value="confirmed">{t.confirmed}</option>
                  <option value="cancelled">{t.cancelled}</option>
                  <option value="completed">{t.completed}</option>
                </select>
              </div>

              {/* Filter: Payment Method */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">{t.filterPayment}</label>
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-hidden focus:border-primary-container"
                >
                  <option value="ALL">{t.allPaymentMethods}</option>
                  <option value="arrival">{t.payOnArrival}</option>
                  <option value="thawani">{t.thawaniOnline}</option>
                </select>
              </div>

              {/* Filter: Search (Phone/Ref/Name) */}
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                  {lang === 'ar' ? 'البحث (الهاتف/المرجع/الاسم)' : 'Search (Phone/Ref/Name)'}
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                  <input
                    type="text"
                    placeholder={lang === 'ar' ? 'ابحث برقم الهاتف أو المرجع...' : 'Phone, Ref, or Name...'}
                    value={filterPhone}
                    onChange={(e) => setFilterPhone(e.target.value)}
                    className="w-full bg-surface-container-high border border-white/10 rounded-xl pl-9 pr-7 py-2 text-xs text-on-surface focus:outline-hidden focus:border-primary-container"
                  />
                  {filterPhone && (
                    <button
                      onClick={() => setFilterPhone('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary text-xs font-bold"
                      title={t.clearFilter}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="glass-panel rounded-3xl overflow-hidden text-on-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-high/60 text-on-surface-variant font-bold border-b border-white/10">
                    <th className="p-4">{t.tableRef}</th>
                    <th className="p-4">{t.tableCustomer}</th>
                    <th className="p-4">{t.tableDateDuration}</th>
                    <th className="p-4">{t.tableAssignedCourts}</th>
                    <th className="p-4">{t.tablePaymentAmount}</th>
                    <th className="p-4">{t.tableStatus}</th>
                    <th className="p-4">{t.tableActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                        {t.noBookingsMatch}
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono font-bold text-primary">{b.referenceCode}</td>
                        <td className="p-4">
                          <div className="font-bold text-primary">{b.customerPhone}</div>
                          {b.customerName && <div className="text-on-surface-variant text-[11px]">{b.customerName}</div>}
                        </td>
                        <td className="p-4">
                          <div className="text-on-surface font-medium flex flex-wrap gap-1">
                            {Array.from(new Set(b.assignedSlots.map((s) => s.date || b.bookingDate))).map((d, idx) => (
                              <span key={idx} className="inline-block bg-surface-container-high px-2 py-0.5 rounded text-[11px] font-mono border border-white/10">
                                {d}
                              </span>
                            ))}
                          </div>
                          <div className="text-on-surface-variant text-[11px] mt-1">{b.totalDurationHours} {lang === 'ar' ? 'ساعة' : 'Hour(s)'}</div>
                        </td>
                        <td className="p-4 space-y-1">
                          {b.assignedSlots.map((slot, i) => (
                            <div key={i} className="bg-surface-container-high px-2.5 py-1.5 rounded-lg text-[11px] text-on-surface-variant border border-white/10 flex items-center justify-between gap-3">
                              <span className="font-bold text-primary">{slot.courtName}</span>
                              <span className="text-[10px] text-on-surface-variant font-mono">
                                {slot.date ? `${slot.date} @ ` : ''}{slot.slotTime}
                              </span>
                            </div>
                          ))}
                        </td>
                        <td className="p-4">
                          <div className="font-mono font-bold text-primary text-sm">{b.totalAmount.toFixed(2)} {currency}</div>
                          <div className="text-[11px] text-on-surface-variant uppercase">
                            {b.paymentMethod === 'arrival' ? t.payOnArrival : t.thawaniOnline} • <span className={b.paymentStatus === 'paid' ? 'text-primary-container font-bold' : b.paymentStatus === 'failed' ? 'text-error font-bold' : 'text-amber-400'}>{b.paymentStatus === 'paid' ? t.payStatusPaid : b.paymentStatus === 'failed' ? t.payStatusFailed : b.paymentStatus === 'cancelled' ? t.cancelled : t.payStatusPending}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {/* pending_payment must be named explicitly: falling through
                              to "Completed" told staff an abandoned, unpaid checkout
                              was a finished session — the opposite of the truth, while
                              it still holds the slot. */}
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                              b.bookingStatus === 'confirmed'
                                ? 'bg-primary-container/10 text-primary-container border border-primary-container/30'
                                : b.bookingStatus === 'cancelled'
                                ? 'bg-error-container/20 text-error border border-error/30'
                                : b.bookingStatus === 'pending_payment'
                                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30'
                                : 'bg-surface-container-high text-on-surface-variant border border-white/10'
                            }`}
                          >
                            {b.bookingStatus === 'confirmed'
                              ? t.confirmed
                              : b.bookingStatus === 'cancelled'
                              ? t.cancelled
                              : b.bookingStatus === 'pending_payment'
                              ? t.awaitingPayment
                              : t.completed}
                          </span>
                        </td>
                        <td className="p-4">
                          {b.bookingStatus === 'confirmed' && (
                            <button
                              onClick={() => {
                                setActionError(null);
                                setBookingToCancel(b);
                              }}
                              className="text-error hover:opacity-80 font-bold text-[11px] cursor-pointer transition-opacity"
                            >
                              {t.cancelBookingBtn}
                            </button>
                          )}
                          {/* Cash at reception has no gateway to confirm it, so staff
                              record the outcome here. Offered once the session is in
                              the past — before that, "expected on arrival" is correct
                              and there is nothing to settle yet. */}
                          {b.paymentMethod === 'arrival' &&
                            b.paymentStatus === 'pending' &&
                            b.bookingStatus !== 'cancelled' &&
                            b.bookingDate < todayStr && (
                              <div className="flex flex-col gap-1 mt-1">
                                <button
                                  onClick={() => handleSettleBooking(b, 'paid')}
                                  className="text-primary-container hover:opacity-80 font-bold text-[11px] cursor-pointer transition-opacity text-start"
                                >
                                  {t.markPaid}
                                </button>
                                <button
                                  onClick={() => handleSettleBooking(b, 'no_show')}
                                  className="text-on-surface-variant hover:text-error font-bold text-[11px] cursor-pointer transition-colors text-start"
                                >
                                  {t.markNoShow}
                                </button>
                              </div>
                            )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COURT MANAGEMENT */}
      {activeTab === 'courts' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-primary">{t.manageCourtsTitle}</h3>
            <button
              onClick={() => setShowAddCourt(true)}
              className="bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors neon-glow"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addNewCourt}</span>
            </button>
          </div>

          <motion.div variants={gridStagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {courts.map((court) => (
              <motion.div key={court.id} variants={gridItem} className="glass-panel rounded-2xl p-5 space-y-4 border-t border-t-white/15">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-base text-primary">{court.name}</h4>
                    <span className="text-xs text-on-surface-variant">{court.surfaceType || t.courtSurface}</span>
                  </div>
                  <button
                    onClick={() => handleToggleCourtActive(court)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                      court.isActive
                        ? 'bg-primary-container/10 text-primary-container border border-primary-container/30'
                        : 'bg-surface-container-high text-on-surface-variant border border-white/10'
                    }`}
                  >
                    {court.isActive ? t.active : t.inactive}
                  </button>
                </div>

                <div className="space-y-2 text-xs text-on-surface-variant pt-2 border-t border-white/10">
                  <div className="flex justify-between">
                    <span>{t.baseRate}:</span>
                    <span className="font-mono font-bold text-primary">{court.basePricePerHour} {currency} / {t.hourShort}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.operatingHoursTitle}:</span>
                    <span className="font-mono text-on-surface">
                      {court.openingTime} - {court.closingTime}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setActionError(null);
                      setCourtToDelete(court);
                    }}
                    className="text-error hover:opacity-80 text-xs font-bold flex items-center gap-1 cursor-pointer transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.delete}</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Add Court Modal */}
          <AnimatePresence>
            {showAddCourt && (
              <motion.div
                variants={modalOverlay}
                initial="hidden"
                animate="show"
                exit="exit"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/70 backdrop-blur-2xl"
              >
                <motion.form
                  variants={modalPanel}
                  onSubmit={handleSaveCourt}
                  className="glass-panel rounded-3xl p-6 w-full max-w-md space-y-4 text-on-surface shadow-2xl border-t border-t-white/15"
                >
                  <h3 className="font-bold text-lg text-primary">{t.addNewCourt}</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-on-surface-variant font-semibold mb-1">{t.courtNameLabel}</label>
                      <input
                        type="text"
                        required
                        placeholder={t.courtNamePlaceholder}
                        value={courtForm.name}
                        onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })}
                        className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-on-surface-variant font-semibold mb-1">{t.baseRate} ({currency})</label>
                      <input
                        type="number"
                        required
                        value={courtForm.basePricePerHour}
                        onChange={(e) => setCourtForm({ ...courtForm, basePricePerHour: Number(e.target.value) })}
                        className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-on-surface-variant font-semibold mb-1">{t.openingTimeLabel}</label>
                        <input
                          type="time"
                          value={courtForm.openingTime}
                          onChange={(e) => setCourtForm({ ...courtForm, openingTime: e.target.value })}
                          className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-on-surface-variant font-semibold mb-1">{t.closingTimeLabel}</label>
                        <input
                          type="time"
                          value={courtForm.closingTime}
                          onChange={(e) => setCourtForm({ ...courtForm, closingTime: e.target.value })}
                          className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-3 rounded-xl text-xs cursor-pointer transition-colors">
                      {t.saveCourt}
                    </button>
                    <button type="button" onClick={() => setShowAddCourt(false)} className="px-4 bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-semibold hover:bg-surface-bright cursor-pointer transition-colors">
                      {t.cancel}
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 3: CLOSURES & BLACKOUTS */}
      {activeTab === 'closures' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-primary">{t.closuresTitle}</h3>
              <p className="text-xs text-on-surface-variant">{t.closuresDesc}</p>
            </div>
            <button
              onClick={() => setShowAddClosure(true)}
              className="bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors neon-glow"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addClosureBtn}</span>
            </button>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <div className="space-y-3">
              {closures.map((c) => {
                const affectedCourtName = c.courtId === 'ALL' ? t.closureAllCourts : courts.find((ct) => ct.id === c.courtId)?.name || c.courtId;
                return (
                  <div key={c.id} className="bg-surface-container-high/60 border border-white/5 rounded-xl p-4 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-amber-400">{affectedCourtName}</div>
                      <div className="text-on-surface-variant mt-0.5">
                        {c.startDate} {t.dateRangeTo} {c.endDate} — {t.reasonLabel}: <span className="italic text-on-surface">{c.reason}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteClosure(c.id)} className="text-error hover:opacity-80 font-bold cursor-pointer transition-opacity">
                      {t.remove}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Closure Modal */}
          <AnimatePresence>
            {showAddClosure && (
              <motion.div
                variants={modalOverlay}
                initial="hidden"
                animate="show"
                exit="exit"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/70 backdrop-blur-2xl"
              >
                <motion.form
                  variants={modalPanel}
                  onSubmit={handleSaveClosure}
                  className="glass-panel rounded-3xl p-6 w-full max-w-md space-y-4 text-on-surface shadow-2xl border-t border-t-white/15"
                >
                  <h3 className="font-bold text-lg text-primary">{t.addClosureBtn}</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-on-surface-variant font-semibold mb-1">{t.targetCourt}</label>
                      <select
                        value={closureForm.courtId}
                        onChange={(e) => setClosureForm({ ...closureForm, courtId: e.target.value })}
                        className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                      >
                        <option value="ALL">{t.closureAllCourts}</option>
                        {courts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-on-surface-variant font-semibold mb-1">{t.startDate}</label>
                        <input
                          type="date"
                          required
                          value={closureForm.startDate}
                          onChange={(e) => setClosureForm({ ...closureForm, startDate: e.target.value })}
                          className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-on-surface-variant font-semibold mb-1">{t.endDate}</label>
                        <input
                          type="date"
                          required
                          value={closureForm.endDate}
                          onChange={(e) => setClosureForm({ ...closureForm, endDate: e.target.value })}
                          className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-on-surface-variant font-semibold mb-1">{t.reasonLabel}</label>
                      <input
                        type="text"
                        required
                        placeholder={t.reasonPlaceholder}
                        value={closureForm.reason}
                        onChange={(e) => setClosureForm({ ...closureForm, reason: e.target.value })}
                        className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-3 rounded-xl text-xs cursor-pointer transition-colors">
                      {t.saveClosure}
                    </button>
                    <button type="button" onClick={() => setShowAddClosure(false)} className="px-4 bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-semibold hover:bg-surface-bright cursor-pointer transition-colors">
                      {t.cancel}
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 4: TIERED PRICING RULES */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-primary">{t.pricingRulesTitle}</h3>
              <p className="text-xs text-on-surface-variant">{t.pricingRulesDesc}</p>
            </div>
            <button
              onClick={() => setShowAddRule(true)}
              className="bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors neon-glow"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addRuleBtn}</span>
            </button>
          </div>

          <motion.div variants={gridStagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pricingRules.map((rule) => (
              <motion.div key={rule.id} variants={gridItem} className="glass-panel rounded-2xl p-5 space-y-2 border-t border-t-white/15">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-primary-container font-bold text-sm">
                    {rule.minHours}-{rule.maxHours} {t.hoursBracket}
                  </span>
                  <span className="bg-primary-container/10 text-primary-container border border-primary-container/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {t.active}
                  </span>
                </div>
                <div className="font-heading text-3xl font-bold text-primary">{rule.ratePerHour} {currency} <span className="font-sans text-xs font-normal text-on-surface-variant">/ {t.hourShort}</span></div>
                <p className="text-xs text-on-surface-variant">{rule.description}</p>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="flex items-center gap-1.5 text-error hover:opacity-80 text-xs font-bold cursor-pointer transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.delete}</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Add Rule Modal */}
          <AnimatePresence>
            {showAddRule && (
              <motion.div
                variants={modalOverlay}
                initial="hidden"
                animate="show"
                exit="exit"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/70 backdrop-blur-2xl"
              >
                <motion.form
                  variants={modalPanel}
                  onSubmit={handleSaveRule}
                  className="glass-panel rounded-3xl p-6 w-full max-w-md space-y-4 text-on-surface shadow-2xl border-t border-t-white/15"
                >
                  <h3 className="font-bold text-lg text-primary">{t.addRuleBtn}</h3>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-on-surface-variant font-semibold mb-1">{t.minHours}</label>
                        <input
                          type="number"
                          required
                          value={ruleForm.minHours}
                          onChange={(e) => setRuleForm({ ...ruleForm, minHours: Number(e.target.value) })}
                          className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-on-surface-variant font-semibold mb-1">{t.maxHours}</label>
                        <input
                          type="number"
                          required
                          value={ruleForm.maxHours}
                          onChange={(e) => setRuleForm({ ...ruleForm, maxHours: Number(e.target.value) })}
                          className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-on-surface-variant font-semibold mb-1">{t.appliedHourlyRate} ({currency}/{t.hourShort})</label>
                      <input
                        type="number"
                        required
                        value={ruleForm.ratePerHour}
                        onChange={(e) => setRuleForm({ ...ruleForm, ratePerHour: Number(e.target.value) })}
                        className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-on-surface-variant font-semibold mb-1">{t.description}</label>
                      <input
                        type="text"
                        required
                        placeholder={t.rulePlaceholder}
                        value={ruleForm.description}
                        onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                        className="w-full bg-surface-container-high border border-white/10 rounded-xl px-3 py-2 text-on-surface focus:border-primary-container outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-3 rounded-xl text-xs cursor-pointer transition-colors">
                      {t.saveRule}
                    </button>
                    <button type="button" onClick={() => setShowAddRule(false)} className="px-4 bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-semibold hover:bg-surface-bright cursor-pointer transition-colors">
                      {t.cancel}
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CANCEL BOOKING CONFIRMATION MODAL */}
      <AnimatePresence>
        {bookingToCancel && (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/70 backdrop-blur-2xl"
          >
            <motion.div variants={modalPanel} className="glass-panel rounded-3xl p-6 w-full max-w-md space-y-4 text-on-surface shadow-2xl border-t border-t-white/15">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-error-container/30 text-error flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-primary">{t.confirmCancelTitle}</h3>
                  <p className="text-xs text-on-surface-variant font-mono">{bookingToCancel.referenceCode}</p>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                {t.confirmCancelBody} <strong className="font-mono text-primary">{bookingToCancel.referenceCode}</strong> ({bookingToCancel.customerPhone})?
              </p>

              {actionError && (
                <div className="p-3 rounded-xl bg-error-container/20 border border-error/30 text-on-error-container text-xs font-semibold">
                  {actionError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={executeCancelBooking}
                  disabled={isProcessingAction}
                  className="flex-1 bg-error hover:opacity-90 text-on-error font-bold py-3 rounded-xl text-xs transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction ? (lang === 'ar' ? 'جاري الإلغاء...' : 'Cancelling...') : t.yesCancel}
                </button>
                <button
                  onClick={() => { setBookingToCancel(null); setActionError(null); }}
                  disabled={isProcessingAction}
                  className="px-4 bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-semibold hover:bg-surface-bright cursor-pointer transition-colors"
                >
                  {t.noKeep}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE COURT CONFIRMATION MODAL */}
      <AnimatePresence>
        {courtToDelete && (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/70 backdrop-blur-2xl"
          >
            <motion.div variants={modalPanel} className="glass-panel rounded-3xl p-6 w-full max-w-md space-y-4 text-on-surface shadow-2xl border-t border-t-white/15">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-error-container/30 text-error flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-primary">{t.confirmDeleteCourtTitle}</h3>
                  <p className="text-xs text-on-surface-variant">{courtToDelete.name}</p>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                {t.confirmDeleteCourtBody} <strong className="text-primary">{courtToDelete.name}</strong>?
              </p>

              {actionError && (
                <div className="p-3 rounded-xl bg-error-container/20 border border-error/30 text-on-error-container text-xs font-semibold">
                  {actionError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={executeDeleteCourt}
                  disabled={isProcessingAction}
                  className="flex-1 bg-error hover:opacity-90 text-on-error font-bold py-3 rounded-xl text-xs transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction ? (lang === 'ar' ? 'جاري الحذف...' : 'Deleting...') : t.yesDelete}
                </button>
                <button
                  onClick={() => { setCourtToDelete(null); setActionError(null); }}
                  disabled={isProcessingAction}
                  className="px-4 bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-semibold hover:bg-surface-bright cursor-pointer transition-colors"
                >
                  {t.noKeep}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
