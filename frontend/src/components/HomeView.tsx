import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Calendar, Ticket, Zap, MapPin, Clock, TrendingDown, Layers, UserCheck, CalendarOff, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';
import { ROUTES } from './Navbar';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } }
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28 } }
};

export const HomeView: React.FC = () => {
  const { lang, isRTL } = useApp();
  const t = translations[lang];

  const stats = [
    { icon: <Layers className="w-5 h-5" />, value: '8', label: t.homeStatCourts, desc: t.homeStatCourtsDesc },
    { icon: <Clock className="w-5 h-5" />, value: t.homeStatHours, label: t.homeStatHoursDesc, desc: '' },
    { icon: <TrendingDown className="w-5 h-5" />, value: t.homeStatFrom, label: t.homeStatFromDesc, desc: '' }
  ];

  const steps = [
    { n: '01', title: t.homeStep1Title, desc: t.homeStep1Desc, icon: <Calendar className="w-5 h-5" /> },
    { n: '02', title: t.homeStep2Title, desc: t.homeStep2Desc, icon: <Zap className="w-5 h-5" /> },
    { n: '03', title: t.homeStep3Title, desc: t.homeStep3Desc, icon: <MapPin className="w-5 h-5" /> }
  ];

  const features = [
    { title: t.homeFeature1Title, desc: t.homeFeature1Desc, icon: <TrendingDown className="w-5 h-5" /> },
    { title: t.homeFeature2Title, desc: t.homeFeature2Desc, icon: <Layers className="w-5 h-5" /> },
    { title: t.homeFeature3Title, desc: t.homeFeature3Desc, icon: <UserCheck className="w-5 h-5" /> },
    { title: t.homeFeature4Title, desc: t.homeFeature4Desc, icon: <CalendarOff className="w-5 h-5" /> }
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-panel rounded-3xl relative overflow-hidden border-t border-t-white/15"
      >
        {/* Background photo — a real <img> with fetchpriority="high" rather than a
            CSS background-image, so the browser can discover and prioritize it
            from the initial HTML instead of waiting on CSS/JS to apply it. This
            is the page's LCP element; Lighthouse measured a 425ms load delay
            before the old background-image version was even requested. */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/padel-hero-2.jpg"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/75 to-surface/25" />
          <div className={`absolute inset-0 ${isRTL ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-surface/90 via-surface/55 to-transparent`} />
        </div>

        <div className="relative z-10 px-6 sm:px-12 py-16 sm:py-24 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 glass-panel border-primary-container/30 px-3.5 py-1 rounded-full text-xs font-extrabold text-primary-container">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(195,244,0,0.8)]" />
            <span>{t.homeHeroBadge}</span>
          </div>

          <h1 className="font-heading text-5xl sm:text-7xl font-extrabold italic tracking-tight text-primary leading-[1.02]">
            {t.homeHeroTitle}
          </h1>

          <p className="text-on-surface-variant text-base sm:text-lg leading-relaxed max-w-xl">
            {t.homeHeroSubtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to={ROUTES.book}
                className="inline-flex items-center gap-2.5 bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-black px-7 py-4 rounded-2xl text-sm transition-colors neon-glow neon-glow-hover"
              >
                <Calendar className="w-4 h-4" />
                <span>{t.homeCtaBook}</span>
              </Link>
            </motion.div>

            <Link
              to={ROUTES.myBooking}
              className="inline-flex items-center gap-2.5 glass-panel text-on-surface hover:text-primary-container hover:bg-white/10 font-bold px-6 py-4 rounded-2xl text-sm transition-colors"
            >
              <Ticket className="w-4 h-4 text-primary-container" />
              <span>{t.homeCtaMyBooking}</span>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ── Stat strip ───────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {stats.map((s, i) => (
          <motion.div
            key={i}
            variants={item}
            className="glass-panel neon-glow-hover rounded-2xl p-6 flex items-center gap-4 border-t border-t-white/15"
          >
            <div className="h-12 w-12 rounded-2xl bg-secondary-container text-secondary-fixed flex items-center justify-center shrink-0">
              {s.icon}
            </div>
            <div>
              <div className="font-heading text-2xl font-extrabold text-primary leading-tight">{s.value}</div>
              <div className="text-xs text-on-surface-variant font-medium">{s.label}</div>
              {s.desc && <div className="text-[11px] text-on-surface-variant/70">{s.desc}</div>}
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-primary">{t.homeHowTitle}</h2>
          <p className="text-sm text-on-surface-variant">{t.homeHowSubtitle}</p>
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {steps.map((s) => (
            <motion.div
              key={s.n}
              variants={item}
              className="glass-panel neon-glow-hover rounded-3xl p-6 space-y-3 border-t border-t-white/15 relative overflow-hidden"
            >
              <span className="absolute top-4 end-5 font-heading text-5xl font-extrabold italic text-primary-container/10 select-none">
                {s.n}
              </span>
              <div className="h-11 w-11 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center neon-glow">
                {s.icon}
              </div>
              <h3 className="font-heading text-2xl font-bold text-primary leading-snug">{s.title}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Why us ───────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-primary">{t.homeWhyTitle}</h2>
            <p className="text-sm text-on-surface-variant">{t.homeWhySubtitle}</p>
          </div>
          <Link
            to={ROUTES.rates}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-container hover:text-primary-fixed-dim transition-colors"
          >
            <span>{t.homeViewRates}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
          </Link>
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              variants={item}
              className="glass-panel rounded-2xl p-5 flex gap-4 border-t border-t-white/15 hover:bg-white/5 transition-colors"
            >
              <div className="h-10 w-10 rounded-xl bg-surface-container-high border border-white/10 text-primary-container flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-primary">{f.title}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.35 }}
        className="glass-panel rounded-3xl p-8 sm:p-12 border-t border-t-white/15 text-center space-y-5"
      >
        <h2 className="font-heading text-4xl sm:text-5xl font-extrabold italic text-primary">{t.homeFinalCtaTitle}</h2>
        <p className="text-sm text-on-surface-variant max-w-lg mx-auto">{t.homeFinalCtaDesc}</p>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
          <Link
            to={ROUTES.book}
            className="inline-flex items-center gap-2.5 bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-black px-8 py-4 rounded-2xl text-sm transition-colors neon-glow neon-glow-hover"
          >
            <span>{t.homeCtaBook}</span>
            <Zap className="w-4 h-4" />
          </Link>
        </motion.div>
      </motion.section>
    </div>
  );
};
