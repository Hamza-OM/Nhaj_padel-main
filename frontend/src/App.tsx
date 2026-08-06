import { Suspense, lazy, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Navbar, ROUTES } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { Footer } from './components/Footer';

// Every route past the home page is code-split into its own chunk. The home
// page (the one Lighthouse measured) was previously paying to parse the admin
// dashboard, the payment flow, and every other page's code on first load —
// 52% of the main bundle was unused JS on that page alone.
const CustomerBookingView = lazy(() =>
  import('./components/CustomerBookingView').then((m) => ({ default: m.CustomerBookingView }))
);
const AdminDashboardView = lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);
const CourtsAndRatesView = lazy(() =>
  import('./components/CourtsAndRatesView').then((m) => ({ default: m.CourtsAndRatesView }))
);
const ClubInfoView = lazy(() =>
  import('./components/ClubInfoView').then((m) => ({ default: m.ClubInfoView }))
);
const MyBookingView = lazy(() =>
  import('./components/MyBookingView').then((m) => ({ default: m.MyBookingView }))
);
const PaymentResultView = lazy(() =>
  import('./components/PaymentResultView').then((m) => ({ default: m.PaymentResultView }))
);

// Three.js pulls in a large chunk — load it async so it never blocks first paint
// of the actual booking UI. The dark surface background (bg-surface) already
// matches the shader's base color, so there's no flash before it mounts.
//
// Only ever rendered on the home route (see below). A Lighthouse audit of the
// production build measured ~2.9s of main-thread time for this component alone
// (shader compile + animation loop) — most of the page's Total Blocking Time.
// It was previously mounted globally, so every route paid that cost even
// though the shader is only visually relevant behind the home page hero.
const WebGLBackground = lazy(() =>
  import('./components/WebGLBackground').then((m) => ({ default: m.WebGLBackground }))
);

/** Jump back to the top whenever the route changes. */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  const location = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col justify-between bg-surface text-on-surface font-sans selection:bg-primary-container selection:text-on-primary-container transition-colors relative">
        {location.pathname === ROUTES.home && (
          <Suspense fallback={null}>
            <WebGLBackground />
          </Suspense>
        )}

        <ScrollToTop />

        <div>
          {/* Top Header Navbar */}
          <Navbar />

          {/* Main View Container with Smooth Motion Transitions */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
              >
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-24">
                      <Loader2 className="w-7 h-7 text-primary-container animate-spin" />
                    </div>
                  }
                >
                  <Routes location={location}>
                    <Route path={ROUTES.home} element={<HomeView />} />
                    <Route path={ROUTES.book} element={<CustomerBookingView />} />
                    <Route path={ROUTES.rates} element={<CourtsAndRatesView />} />
                    <Route path={ROUTES.info} element={<ClubInfoView />} />
                    <Route path={ROUTES.myBooking} element={<MyBookingView />} />
                    <Route path={ROUTES.paymentResult} element={<PaymentResultView />} />
                    <Route path={ROUTES.admin} element={<AdminDashboardView />} />
                    {/* Unknown URL — send people home rather than a blank screen */}
                    <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
                  </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Real Website Footer */}
        <Footer />
      </div>
    </MotionConfig>
  );
}
