import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Phone, Mail, Wifi, Car, Coffee, Shield, HelpCircle, Zap } from 'lucide-react';
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

export const ClubInfoView: React.FC = () => {
  const { lang, currency } = useApp();
  const t = translations[lang];
  const navigate = useNavigate();
  const onBookNow = () => navigate(ROUTES.book);

  const amenities = [
    { icon: <Wifi className="w-5 h-5 text-primary-container" />, title: t.wifiTitle, desc: t.wifiDesc },
    { icon: <Car className="w-5 h-5 text-primary-container" />, title: t.parkingTitle, desc: t.parkingDesc },
    { icon: <Coffee className="w-5 h-5 text-primary-container" />, title: t.cafeTitle, desc: t.cafeDesc },
    { icon: <Shield className="w-5 h-5 text-primary-container" />, title: t.lockersTitle, desc: t.lockersDesc },
  ];

  const faqs = [
    {
      q: lang === 'ar' ? 'كيف يعمل نظام حجز مسبح الملاعب دون تحديد اسم الملعب؟' : 'How does the Anonymous Court Pool allocation work?',
      a: lang === 'ar' ? 'عند اختيار الأوقات، يقوم النظام بحجز طاقة استيعابية من مسبح الملاعب الـ 8 دون تقييدك بملعب محدد. وعند تأكيد الدفع، يتم تخصيص رقم الملعب الفعلي تلقائياً.' : 'When you select time slots, our system reserves pooled capacity without locking in a specific court name until confirmation. Upon payment, physical courts are dynamically assigned.'
    },
    {
      q: lang === 'ar' ? 'ما هي سياسة الإلغاء والاسترداد؟' : 'What is the cancellation and refund policy?',
      a: lang === 'ar' ? 'يمكن إلغاء الحجوزات حتى 6 ساعات قبل موعد الحصة واسترداد المبلغ كاملاً كرصيد.' : 'Bookings can be cancelled up to 6 hours prior to the slot start time with full credit refund.'
    },
    {
      q: lang === 'ar' ? 'هل تتوفر مضارب وكرات باديل للإيجار في الموقع؟' : 'Are rackets and padel balls available for rental on site?',
      a: lang === 'ar' ? `نعم! تتوفر مضارب Wilson و Head احترافية للإيجار بـ 2 ${currency} للحصة في مكتب الاستقبال.` : `Yes! High-performance Wilson and Head padel rackets are available for rent at 2 ${currency} per session at the club counter.`
    },
    {
      q: lang === 'ar' ? 'ما هي طرق الدفع المقبولة؟' : 'What payment methods do you accept?',
      a: lang === 'ar' ? 'نقبل الدفع عند الوصول (نقداً أو بالبطاقة في الاستقبال) بالإضافة إلى بوابة ثواني الإلكترونية Direct Pay.' : 'We accept Pay on Arrival (Cash/Card at reception) as well as Thawani Online Gateway payment.'
    },
  ];

  return (
    <div className="space-y-12 pb-16">
      {/* Top Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-panel rounded-3xl p-8 sm:p-12 relative overflow-hidden border-t border-t-white/15"
      >
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 glass-panel px-3.5 py-1 rounded-full text-xs font-bold text-on-surface">
            <MapPin className="w-3.5 h-3.5 text-primary-container" />
            <span>PadelPoint Arena • Muscat, Sultanate of Oman</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-6xl font-extrabold italic tracking-tight text-primary leading-[1.05]">
            {t.infoHeroTitle}
          </h1>
          <p className="text-on-surface-variant text-base leading-relaxed">
            {t.infoHeroDesc}
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

      {/* Grid: Hours, Location & Contact */}
      <motion.div variants={gridStagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={gridItem} className="glass-panel neon-glow-hover rounded-3xl p-6 space-y-4 border-t border-t-white/15">
          <div className="h-11 w-11 rounded-2xl bg-secondary-container text-secondary-fixed flex items-center justify-center font-bold">
            <Clock className="w-5.5 h-5.5" />
          </div>
          <div>
            <h3 className="font-heading text-2xl font-bold text-primary">{t.operatingHoursTitle}</h3>
            <p className="text-xs text-on-surface-variant">{t.operatingHoursSubtitle}</p>
          </div>
          <div className="space-y-2 text-xs font-medium text-on-surface-variant border-t border-white/10 pt-3">
            <div className="flex justify-between">
              <span>{t.hoursMonSun}</span>
              <span className="font-bold text-primary font-mono">{t.hoursTimeMonSun}</span>
            </div>
            <div className="flex justify-between">
              <span>{t.hoursHolidays}</span>
              <span className="font-bold text-primary font-mono">{t.hoursTimeHolidays}</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={gridItem} className="glass-panel neon-glow-hover rounded-3xl p-6 space-y-4 border-t border-t-white/15">
          <div className="h-11 w-11 rounded-2xl bg-secondary-container text-secondary-fixed flex items-center justify-center font-bold">
            <MapPin className="w-5.5 h-5.5" />
          </div>
          <div>
            <h3 className="font-heading text-2xl font-bold text-primary">{t.locationTitle}</h3>
            <p className="text-xs text-on-surface-variant">{t.locationSubtitle}</p>
          </div>
          <p className="text-xs text-on-surface-variant border-t border-white/10 pt-3 leading-relaxed font-medium">
            {t.locationAddress}
          </p>
        </motion.div>

        <motion.div variants={gridItem} className="glass-panel neon-glow-hover rounded-3xl p-6 space-y-4 border-t border-t-white/15">
          <div className="h-11 w-11 rounded-2xl bg-secondary-container text-secondary-fixed flex items-center justify-center font-bold">
            <Phone className="w-5.5 h-5.5" />
          </div>
          <div>
            <h3 className="font-heading text-2xl font-bold text-primary">{t.contactTitle}</h3>
            <p className="text-xs text-on-surface-variant">{t.contactSubtitle}</p>
          </div>
          <div className="space-y-2 text-xs text-on-surface-variant border-t border-white/10 pt-3">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-primary-container" />
              <span className="font-bold text-primary font-mono">{t.contactPhone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-primary-container" />
              <span>{t.contactEmail}</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Amenities Section */}
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-3xl font-bold text-primary">{t.amenitiesTitle}</h2>
          <p className="text-sm text-on-surface-variant">{t.amenitiesSubtitle}</p>
        </div>

        <motion.div variants={gridStagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {amenities.map((a, idx) => (
            <motion.div key={idx} variants={gridItem} className="glass-panel neon-glow-hover rounded-2xl p-5 space-y-3 border-t border-t-white/15">
              <div className="h-10 w-10 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center">
                {a.icon}
              </div>
              <h3 className="font-black text-sm text-primary">{a.title}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">{a.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* FAQ Section */}
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-3xl font-bold text-primary">{t.faqTitle}</h2>
          <p className="text-sm text-on-surface-variant">Got questions about booking, court pools, or payments?</p>
        </div>

        <motion.div variants={gridStagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((f, i) => (
            <motion.div key={i} variants={gridItem} className="glass-panel rounded-2xl p-5 space-y-2 border-t border-t-white/15 hover:bg-white/5 transition-colors">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-primary-container shrink-0 mt-0.5" />
                <h3 className="font-black text-sm text-primary leading-snug">{f.q}</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">{f.a}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
