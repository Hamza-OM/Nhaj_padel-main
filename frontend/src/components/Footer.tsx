import React from 'react';
import { Calendar, ShieldCheck, MapPin, Clock, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../utils/translations';
import { AppTab } from './Navbar';

interface FooterProps {
  onSelectTab: (tab: AppTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  const { lang } = useApp();
  const t = translations[lang];

  return (
    <footer className="bg-surface-container-lowest/90 backdrop-blur-md text-on-surface border-t border-white/5 mt-20 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center neon-glow">
                <div className="w-3 h-3 bg-on-primary-container rounded-full"></div>
              </div>
              <span className="font-heading text-2xl font-extrabold italic tracking-tighter text-primary leading-none">
                {t.brandName}<span className="text-primary-container">{t.brandAccent}</span>
              </span>
            </div>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              {t.footerDesc}
            </p>
            <div className="flex items-center gap-2 pt-1 text-on-surface-variant">
              <MapPin className="w-3.5 h-3.5 text-primary-container shrink-0" />
              <span>{t.footerLocation}</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-primary uppercase tracking-wider">{t.navBookCourt} & More</h4>
            <ul className="space-y-2 text-on-surface-variant">
              <li>
                <button
                  onClick={() => onSelectTab('customer')}
                  className="hover:text-primary-container transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-primary-container" />
                  <span>{t.navBookCourt}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('rates')}
                  className="hover:text-primary-container transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{t.navCourtsRates}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('info')}
                  className="hover:text-primary-container transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{t.navClubInfo}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('admin')}
                  className="hover:text-primary-container transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-primary-container" />
                  <span>{t.navAdminPortal}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Operating Hours */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-primary uppercase tracking-wider">{t.operatingHoursTitle}</h4>
            <div className="space-y-1.5 text-on-surface-variant">
              <div className="flex items-center gap-1.5 font-medium text-on-surface">
                <Clock className="w-3.5 h-3.5 text-primary-container" />
                <span>{t.hoursMonSun} {t.hoursTimeMonSun}</span>
              </div>
              <p className="text-[11px] text-on-surface-variant">14-Day advance online bookings enabled.</p>
              <div className="pt-2 text-on-surface-variant">
                <span className="block font-medium text-on-surface">{t.contactTitle}:</span>
                <span>{t.contactPhone} • {t.contactEmail}</span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-primary uppercase tracking-wider">{t.paymentMethodTitle}</h4>
            <p className="text-on-surface-variant text-[11px] leading-relaxed">
              We accept Pay on Arrival (Cash or Card at reception) and Thawani Online Gateway payments in Omani Rial (OMR).
            </p>
            <div className="flex items-center gap-2 pt-2">
              <div className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2 text-primary-container font-bold text-xs">
                <CreditCard className="w-4 h-4" />
                <span>Thawani Payment Gateway</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-on-surface-variant text-[11px]">
          <p>© {new Date().getFullYear()} {t.footerRights}</p>
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <span>Dynamic Tiered Rates</span>
            <span>•</span>
            <span>Anonymous Pool Engine</span>
            <span>•</span>
            <span>Thawani Payment Gateway</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
