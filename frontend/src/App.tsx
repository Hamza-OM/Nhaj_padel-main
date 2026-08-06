import { Suspense, lazy, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar, ROUTES } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { CustomerBookingView } from './components/CustomerBookingView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { CourtsAndRatesView } from './components/CourtsAndRatesView';
import { ClubInfoView } from './components/ClubInfoView';
import { MyBookingView } from './components/MyBookingView';
import { PaymentResultView } from './components/PaymentResultView';
import { Footer } from './components/Footer';

// Three.js pulls in a large chunk — load it async so it never blocks first paint
// of the actual booking UI. The dark surface background (bg-surface) already
// matches the shader's base color, so there's no flash before it mounts.
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
        <Suspense fallback={null}>
          <WebGLBackground />
        </Suspense>

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
