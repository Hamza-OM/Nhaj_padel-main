import { useState, Suspense, lazy } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Navbar, AppTab } from './components/Navbar';
import { CustomerBookingView } from './components/CustomerBookingView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { CourtsAndRatesView } from './components/CourtsAndRatesView';
import { ClubInfoView } from './components/ClubInfoView';
import { MyBookingView } from './components/MyBookingView';
import { Footer } from './components/Footer';

// Three.js pulls in a large chunk — load it async so it never blocks first paint
// of the actual booking UI. The dark surface background (bg-surface) already
// matches the shader's base color, so there's no flash before it mounts.
const WebGLBackground = lazy(() =>
  import('./components/WebGLBackground').then((m) => ({ default: m.WebGLBackground }))
);

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('customer');

  const handleBookNow = () => {
    setCurrentTab('customer');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col justify-between bg-surface text-on-surface font-sans selection:bg-primary-container selection:text-on-primary-container transition-colors relative">
        <Suspense fallback={null}>
          <WebGLBackground />
        </Suspense>

        <div>
          {/* Top Header Navbar */}
          <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

          {/* Main View Container with Smooth Motion Transitions */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
              >
                {currentTab === 'customer' && <CustomerBookingView />}
                {currentTab === 'rates' && <CourtsAndRatesView onBookNow={handleBookNow} />}
                {currentTab === 'info' && <ClubInfoView onBookNow={handleBookNow} />}
                {currentTab === 'mybooking' && <MyBookingView />}
                {currentTab === 'admin' && <AdminDashboardView />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Real Website Footer */}
        <Footer onSelectTab={setCurrentTab} />
      </div>
    </MotionConfig>
  );
}
