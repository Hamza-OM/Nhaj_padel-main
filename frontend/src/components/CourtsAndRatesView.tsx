import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Zap, Award, Layers } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';
import { ROUTES } from './Navbar';

const gridStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } }
};
const gridItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
};

export const CourtsAndRatesView: React.FC = () => {
  const { lang, currency } = useApp();
  const t = translations[lang];
  const navigate = useNavigate();
  const onBookNow = () => navigate(ROUTES.book);

  // All eight courts are deliberately identical — that is what makes the
  // anonymous pool work: any court can be assigned at random for one flat
  // rate. Advertising an indoor/outdoor split here would contradict both the
  // allocation logic and the seeded data, which the admin panel displays.
  const courtsList = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `${lang === 'ar' ? 'ملعب رقم' : 'Court #'} ${i + 1}`,
    type: t.courtTypeLabel,
    surface: t.courtSurface,
    lighting: t.courtLighting,
  }));

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-panel rounded-3xl p-8 sm:p-12 relative overflow-hidden border-t border-t-white/15"
      >
        {/* Background photo: indoor padel action shot (Olegs Jonins / Unsplash License) */}
        <div className="absolute inset-0 z-0">
          <div
            className="w-full h-full bg-cover bg-center mix-blend-luminosity opacity-40"
            style={{ backgroundImage: "url('/images/padel-hero.jpg')" }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/20"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/50 to-transparent"></div>
        </div>

        <div className="max-w-3xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 glass-panel border-primary-container/30 px-3.5 py-1 rounded-full text-xs font-extrabold text-primary-container">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(195,244,0,0.8)]"></span>
            <span>{t.ratesHeroBadge}</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-6xl font-extrabold italic tracking-tight text-primary leading-[1.05]">
            {t.ratesHeroTitle}
          </h1>
          <p className="text-on-surface-variant text-base leading-relaxed">
            {t.ratesHeroDesc}
          </p>
          <div className="pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBookNow}
              className="inline-flex items-center gap-2.5 bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-black px-7 py-3.5 rounded-2xl text-sm transition-colors neon-glow neon-glow-hover cursor-pointer"
            >
              <span>{t.navBookCourt}</span>
              <Zap className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Tiered Rates Matrix */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-3xl font-bold text-primary">{t.ratesMatrixTitle}</h2>
            <p className="text-sm text-on-surface-variant">{t.ratesMatrixSubtitle}</p>
          </div>
          <span className="bg-surface-container-high text-primary-container font-bold text-xs px-3 py-1.5 rounded-full border border-primary-container/20">
            {lang === 'ar' ? 'تطبيق تلقائي' : 'Auto-Applied'}
          </span>
        </div>

        <motion.div variants={gridStagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div variants={gridItem} className="glass-panel neon-glow-hover rounded-3xl p-6 space-y-4 border-t border-t-white/15">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-on-surface-variant tracking-wider">{t.rate1hrTitle}</span>
              <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">{t.rate1hrBadge}</span>
            </div>
            <div className="space-y-1">
              <div className="font-heading text-5xl font-bold text-primary tracking-tight">{t.rate1hrPrice} <span className="font-sans text-sm font-normal text-on-surface-variant">{t.perHour}</span></div>
              <p className="text-xs text-on-surface-variant">{t.rate1hrDesc}</p>
            </div>
            <ul className="space-y-2 pt-4 border-t border-white/10 text-xs text-on-surface-variant">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                <span>{lang === 'ar' ? 'حجز ملعب كامل لمدة 60 دقيقة' : 'Full court rental for 60 mins'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                <span>{lang === 'ar' ? 'توفير خدمة تأجير المضارب' : 'Racket rental available'}</span>
              </li>
            </ul>
          </motion.div>

          <motion.div variants={gridItem} className="glass-panel rounded-3xl p-6 space-y-4 relative overflow-hidden border-2 border-primary-container neon-glow">
            <div className="absolute top-0 right-0 bg-primary-container text-on-primary-container font-black text-[10px] uppercase px-3.5 py-1 rounded-bl-xl tracking-wider">
              {lang === 'ar' ? 'الأكثر طلباً' : 'Popular'}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-primary-container tracking-wider">{t.rate2hrTitle}</span>
              <span className="bg-primary-container/10 text-primary-container text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">{t.rate2hrBadge}</span>
            </div>
            <div className="space-y-1">
              <div className="font-heading text-5xl font-bold text-primary tracking-tight">{t.rate2hrPrice} <span className="font-sans text-sm font-normal text-on-surface-variant">{t.perHour}</span></div>
              <p className="text-xs text-primary-container font-extrabold">{t.rate2hrDesc}</p>
            </div>
            <ul className="space-y-2 pt-4 border-t border-white/10 text-xs text-on-surface-variant">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                <span>{lang === 'ar' ? '120 دقيقة لعب مستمر' : '120 mins continuous play time'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                <span>{lang === 'ar' ? 'خصم 20% على سعر الساعة' : '20% off standard hourly rate'}</span>
              </li>
            </ul>
          </motion.div>

          <motion.div variants={gridItem} className="glass-panel neon-glow-hover rounded-3xl p-6 space-y-4 border-t border-t-white/15">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-on-surface-variant tracking-wider">{t.rate3hrTitle}</span>
              <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">{t.rate3hrBadge}</span>
            </div>
            <div className="space-y-1">
              <div className="font-heading text-5xl font-bold text-primary tracking-tight">{t.rate3hrPrice} <span className="font-sans text-sm font-normal text-on-surface-variant">{t.perHour}</span></div>
              <p className="text-xs text-on-surface-variant">{t.rate3hrDesc}</p>
            </div>
            <ul className="space-y-2 pt-4 border-t border-white/10 text-xs text-on-surface-variant">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                <span>{lang === 'ar' ? '180+ دقيقة لعب مستمر' : '180+ mins continuous play time'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                <span>{lang === 'ar' ? 'أقصى خصم مدة يصل 30%' : 'Maximum 30% duration discount'}</span>
              </li>
            </ul>
          </motion.div>
        </motion.div>
      </div>

      {/* Facilities & Court Specifications */}
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-3xl font-bold text-primary">{t.courtsGridTitle}</h2>
          <p className="text-sm text-on-surface-variant">{t.courtsGridSubtitle}</p>
        </div>

        <motion.div variants={gridStagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {courtsList.map((c) => (
            <motion.div key={c.id} variants={gridItem} className="glass-panel neon-glow-hover rounded-2xl p-5 space-y-3 border-t border-t-white/15">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base text-primary">{c.name}</h3>
                <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  {c.type}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary-container shrink-0" />
                  <span>{c.surface}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-primary-container shrink-0" />
                  <span>{c.lighting}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
