import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ShieldCheck, Tag, Info, Globe, Menu, X, ChevronRight, Ticket } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';

export type AppTab = 'customer' | 'rates' | 'info' | 'mybooking' | 'admin';

interface NavbarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { lang, setLang } = useApp();
  const t = translations[lang];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabClick = (tab: AppTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const navItems: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'customer', label: t.navBookCourt, icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: 'rates', label: t.navCourtsRates, icon: <Tag className="w-4 h-4 shrink-0" /> },
    { id: 'info', label: t.navClubInfo, icon: <Info className="w-4 h-4 shrink-0" /> },
    { id: 'mybooking', label: t.navMyBooking, icon: <Ticket className="w-4 h-4 shrink-0" /> },
    { id: 'admin', label: t.navAdminPortal, icon: <ShieldCheck className="w-4 h-4 shrink-0" /> }
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface-dim/80 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-primary-container/5 text-on-surface transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Badges */}
          <button
            onClick={() => handleTabClick('customer')}
            className="flex items-center gap-2.5 sm:gap-3 text-start cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-container rounded-xl flex items-center justify-center shadow-sm neon-glow group-hover:shadow-md transition-shadow shrink-0">
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-on-primary-container rounded-full"></div>
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
          </button>

          {/* Desktop Navigation Links (md and up) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 relative">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'text-on-primary-container'
                      : 'text-on-surface-variant hover:text-primary-container hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-primary-container shadow-sm -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  {item.icon}
                  <span>{item.label}</span>
                </button>
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
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'text-on-primary-container'
                    : 'glass-panel text-on-surface-variant'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill-mobile"
                    className="absolute inset-0 rounded-lg bg-primary-container shadow-xs -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                {item.icon}
                <span>{item.label}</span>
              </button>
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
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-colors cursor-pointer ${
                    currentTab === item.id
                      ? 'bg-primary-container/15 text-primary-container border border-primary-container/40'
                      : 'glass-panel text-on-surface hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${currentTab === item.id ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
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
