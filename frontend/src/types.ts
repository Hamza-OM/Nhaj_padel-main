export interface Court {
  id: string;
  name: string; // Internal name (e.g., Court Alpha). Never shown to customer in booking UI!
  basePricePerHour: number; // Base rate in SAR
  openingTime: string; // e.g. "07:00"
  closingTime: string; // e.g. "23:00"
  isActive: boolean;
  surfaceType?: string; // Indoor / Outdoor Glass
  createdAt: string;
}

export interface CourtClosure {
  id: string;
  courtId: string | 'ALL'; // 'ALL' or specific courtId
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  reason: string;
  createdAt: string;
}

export interface TieredPricingRule {
  id: string;
  minHours: number;
  maxHours: number;
  ratePerHour: number; // Applied SAR per hour for duration in this bracket
  description: string;
  isActive: boolean;
}

export interface TimeSlotAvailability {
  time: string; // e.g. "18:00"
  endTime: string; // e.g. "19:00"
  availableCourtsCount: number; // Pooled capacity!
  totalActiveCourts: number;
  isAvailable: boolean;
  reasonIfUnavailable?: string;
}

export interface CartSlotItem {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "18:00"
  endTime: string; // "19:00"
  quantity: number; // how many courts requested for this time slot (e.g. 2 courts)
}

export type PaymentMethod = 'arrival' | 'thawani';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export interface AssignedSlot {
  slotTime: string;
  endTime: string;
  date: string;
  courtId: string;
  courtName: string; // Saved internally for admin view & confirmation ticket
  price: number;
}

export interface Booking {
  id: string;
  referenceCode: string; // e.g., "PAD-78291"
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  bookingDate: string;
  totalDurationHours: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string; // "SAR"
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  thawaniSessionId?: string;
  thawaniPaymentUrl?: string;
  assignedSlots: AssignedSlot[];
  createdAt: string;
}

export interface ThawaniCheckoutResponse {
  success: boolean;
  sessionId: string;
  paymentUrl: string;
  mode: 'sandbox' | 'production';
  rawApiResponse?: any;
  thawaniPayloadSample?: any;
}

export interface PricingBreakdown {
  totalHours: number;
  subtotal: number;
  effectiveRatePerHour: number;
  discountAmount: number;
  finalTotal: number;
  tierApplied?: string;
}
