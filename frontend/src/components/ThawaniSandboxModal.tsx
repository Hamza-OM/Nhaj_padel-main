import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Booking, ThawaniCheckoutResponse } from '../types';
import { useApp } from '../context/AppContext';

interface ThawaniSandboxModalProps {
  isOpen: boolean;
  booking: Booking | null;
  thawaniSession: ThawaniCheckoutResponse | null;
  onClose: () => void;
  onPaymentComplete: (status: 'paid' | 'failed') => void;
}

export const ThawaniSandboxModal: React.FC<ThawaniSandboxModalProps> = ({
  isOpen,
  booking,
  thawaniSession,
  onClose,
  onPaymentComplete
}) => {
  const { currency } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'checkout' | 'payload'>('checkout');

  const show = isOpen && !!booking && !!thawaniSession;

  const handleSimulatePayment = (status: 'paid' | 'failed') => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentComplete(status);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {show && booking && thawaniSession && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/70 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="glass-panel rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-on-surface border-t border-t-white/15"
          >
            {/* Header */}
            <div className="border-b border-white/10 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold neon-glow">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-primary">Thawani Payment Gateway</h3>
                    <span className="bg-primary-container/10 text-primary-container border border-primary-container/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Sandbox Mode
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">Testing E-Commerce Checkout Integration</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-on-surface-variant hover:text-primary text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-white/10 px-6 pt-3 gap-6 text-sm font-bold">
              <button
                onClick={() => setActiveTab('checkout')}
                className={`relative pb-3 transition-colors cursor-pointer ${
                  activeTab === 'checkout' ? 'text-primary font-black' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Interactive Sandbox Simulator
                {activeTab === 'checkout' && (
                  <motion.span layoutId="thawani-tab-underline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary-container" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                )}
              </button>
              <button
                onClick={() => setActiveTab('payload')}
                className={`relative pb-3 transition-colors cursor-pointer ${
                  activeTab === 'payload' ? 'text-primary font-black' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Thawani API Request Payload
                {activeTab === 'payload' && (
                  <motion.span layoutId="thawani-tab-underline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary-container" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                )}
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'checkout' ? (
                <div className="space-y-6">
                  {/* Order Summary */}
                  <div className="bg-surface-container-high/60 border border-white/5 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Booking Reference:</span>
                      <span className="font-mono font-bold text-primary">{booking.referenceCode}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Customer Phone:</span>
                      <span className="text-on-surface">{booking.customerPhone}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Total Duration:</span>
                      <span className="text-on-surface">{booking.totalDurationHours} Hour(s)</span>
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between text-sm font-bold">
                      <span className="text-on-surface-variant">Total Amount Payable:</span>
                      <span className="text-primary font-black text-lg">{booking.totalAmount.toFixed(2)} {currency}</span>
                    </div>
                  </div>

                  {/* Sandbox Card Test Info */}
                  <div className="bg-secondary-container/20 border border-secondary/20 rounded-2xl p-4 flex gap-3 items-start">
                    <ShieldAlert className="w-5 h-5 text-secondary-fixed shrink-0 mt-0.5" />
                    <div className="text-xs text-on-surface-variant space-y-1">
                      <p className="font-bold text-secondary-fixed">Thawani Sandbox Test Environment</p>
                      <p>In Thawani sandbox mode, transactions complete instantly without real bank charges.</p>
                      <p className="font-mono text-on-surface-variant">Session ID: {thawaniSession.sessionId}</p>
                    </div>
                  </div>

                  {/* Simulator Action Buttons */}
                  <div className="space-y-3 pt-2">
                    <motion.button
                      whileHover={!isProcessing ? { scale: 1.01 } : undefined}
                      whileTap={!isProcessing ? { scale: 0.98 } : undefined}
                      onClick={() => handleSimulatePayment('paid')}
                      disabled={isProcessing}
                      className="w-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-bold py-4 px-4 rounded-2xl transition-colors neon-glow neon-glow-hover flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessing ? (
                        <span>Authorizing Sandbox Payment...</span>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Simulate Successful Payment ({booking.totalAmount.toFixed(2)} {currency})</span>
                        </>
                      )}
                    </motion.button>

                    <button
                      onClick={() => handleSimulatePayment('failed')}
                      disabled={isProcessing}
                      className="w-full bg-surface-container-high hover:bg-error-container/20 text-error border border-white/10 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Simulate Payment Failure / Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-on-surface-variant">
                    This JSON payload is constructed server-side and posted to{' '}
                    <code className="text-primary-container font-mono bg-primary-container/10 px-1 py-0.5 rounded">https://uatcheckout.thawani.om/api/v1/checkout/session</code> with{' '}
                    <code className="text-primary-container font-mono bg-primary-container/10 px-1 py-0.5 rounded">thawani-api-key</code> headers.
                  </p>
                  <pre className="bg-surface-container-lowest text-primary-container border border-white/10 rounded-2xl p-4 text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
                    {JSON.stringify(thawaniSession.rawApiResponse || thawaniSession.thawaniPayloadSample, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
