import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, ShieldCheck, Tag, Info, Globe, Menu, X, ChevronRight, Ticket } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';

/** Every routed page in the app, in nav order. */
export const ROUTES = {
  home: '/',
  book: '/book',
  rates: '/rates',
  info: '/info',
  myBooking: '/my-booking',
  admin: '/admin',
  paymentResult: '/payment/result'
} as const;

export const Navbar: React.FC = () => {
  const { lang, setLang } = useApp();
  const t = translations[lang];
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { to: string; label: string; icon: React.ReactNode }[] = [
    { to: ROUTES.book, label: t.navBookCourt, icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { to: ROUTES.rates, label: t.navCourtsRates, icon: <Tag className="w-4 h-4 shrink-0" /> },
    { to: ROUTES.info, label: t.navClubInfo, icon: <Info className="w-4 h-4 shrink-0" /> },
    { to: ROUTES.myBooking, label: t.navMyBooking, icon: <Ticket className="w-4 h-4 shrink-0" /> },
    { to: ROUTES.admin, label: t.navAdminPortal, icon: <ShieldCheck className="w-4 h-4 shrink-0" /> }
  ];

  const isActive = (to: string) => location.pathname === to;

  const handleNavigate = (to: string) => {
    navigate(to);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-surface-dim/80 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-primary-container/5 text-on-surface transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Badges — links home */}
          <Link
            to={ROUTES.home}
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 sm:gap-3 text-start cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-container rounded-xl flex items-center justify-center shadow-sm neon-glow group-hover:shadow-md transition-shadow shrink-0">
              {/* Paddle with the ball cut out of its face — the hole is real
                  negative space (evenodd), so it picks up whatever sits behind
                  it rather than hard-coding the tile colour. */}
              <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className="w-5 h-5 sm:w-6 sm:h-6 text-surface">
                <g transform="rotate(-18 32 32)">
                  <path
                    fillRule="evenodd"
                    d="M32 9C43 9 50 17 50 27C50 37 43 45 32 45C21 45 14 37 14 27C14 17 21 9 32 9ZM36.5 18.5A7.5 7.5 0 1 0 36.5 33.5A7.5 7.5 0 1 0 36.5 18.5Z"
                  />
                  <rect x="27.5" y="43" width="9" height="13" rx="4.5" />
                </g>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-heading text-2xl sm:text-3xl font-extrabold italic tracking-tighter text-primary leading-none">
                  {t.brandName}<span className="text-primary-container">{t.brandAccent}</span>
                </span>
                <span className="bg-secondary-container/60 text-secondary-fixed border border-secondary/30 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold">
                  {t.muscatLocation}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant hidden md:block font-medium">{t.tagline}</p>
            </div>
          </Link>

          {/* Desktop Navigation Links (md and up) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 relative">
            {navItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'text-on-primary-container'
                      : 'text-on-surface-variant hover:text-primary-container hover:bg-white/5'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-primary-container shadow-sm -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right side controls: Language & Mobile Hamburger Menu Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language Switcher Button */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold glass-panel text-on-surface hover:bg-white/10 transition-colors cursor-pointer"
              title={lang === 'en' ? 'تحويل إلى العربية' : 'Switch to English'}
            >
              <Globe className="w-3.5 h-3.5 text-primary-container" />
              <span>{lang === 'en' ? 'العربية' : 'EN'}</span>
            </button>

            {/* Mobile Hamburger Menu Toggle Button (visible on mobile only) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl glass-panel text-primary-container transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Fast-Tab Strip (always visible on mobile for 1-tap navigation) */}
        <div className="md:hidden flex items-center gap-1.5 py-2 overflow-x-auto scrollbar-none border-t border-white/5">
          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  active ? 'text-on-primary-container' : 'glass-panel text-on-surface-variant'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill-mobile"
                    className="absolute inset-0 rounded-lg bg-primary-container shadow-xs -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile Menu Dropdown Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="md:hidden border-t border-white/10 bg-surface-container-low/95 backdrop-blur-xl shadow-xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-3 pb-1">
                {lang === 'ar' ? 'قائمة التنقل' : 'Navigation Menu'}
              </div>
              {navItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => handleNavigate(item.to)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-colors cursor-pointer ${
                    isActive(item.to)
                      ? 'bg-primary-container/15 text-primary-container border border-primary-container/40'
                      : 'glass-panel text-on-surface hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isActive(item.to) ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {item.icon}
                    </div>
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
