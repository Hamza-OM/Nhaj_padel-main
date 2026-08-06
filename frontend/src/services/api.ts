import type {
  Court,
  CourtClosure,
  TieredPricingRule,
  Booking,
  TimeSlotAvailability,
  PricingBreakdown,
  CartSlotItem,
  ThawaniCheckoutResponse,
  PaymentResultResponse
} from '../types';

const API_BASE = '/api';

// The admin session token (Sanctum personal access token) lives only in this
// tab's sessionStorage — never in a build-time env var, never shipped to
// every visitor. It only exists here after a real POST /admin/login with a
// real password succeeds.
const ADMIN_TOKEN_KEY = 'padel_admin_token';

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

// Wraps fetch for /api/admin/* routes, attaching the session token as a
// bearer token. On a 401 (missing/expired/revoked token) it clears the
// stored token so the UI can detect that and fall back to the login screen.
async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (res.status === 401) clearAdminToken();

  return res;
}

export async function adminLogin(email: string, password: string): Promise<{ name: string; email: string }> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Login failed');
  setAdminToken(json.token);
  return json.user;
}

export async function adminLogout(): Promise<void> {
  await adminFetch('/admin/logout', { method: 'POST' }).catch(() => {});
  clearAdminToken();
}

/** Verifies a stored token is still valid — used on page load/refresh. */
export async function verifyAdminSession(): Promise<{ name: string; email: string }> {
  const res = await adminFetch('/admin/me');
  if (!res.ok) throw new Error('Session expired');
  return res.json();
}

export async function fetchSlotAvailability(dateStr: string): Promise<{
  date: string;
  totalCourtsCount: number;
  slots: TimeSlotAvailability[];
}> {
  const res = await fetch(`${API_BASE}/slots/availability?date=${encodeURIComponent(dateStr)}`);
  if (!res.ok) throw new Error('Failed to load slot availability');
  return res.json();
}

export async function calculatePricingPreview(totalHours: number): Promise<PricingBreakdown> {
  const res = await fetch(`${API_BASE}/pricing/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalHours })
  });
  if (!res.ok) throw new Error('Failed to calculate pricing breakdown');
  return res.json();
}

export async function createBookingTransaction(data: {
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  paymentMethod: 'arrival' | 'thawani';
  cartItems: CartSlotItem[];
}): Promise<{ success: boolean; message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to place booking');
  return json;
}

export async function lookupBooking(
  reference: string,
  phone: string
): Promise<{ success: boolean; booking: Booking; cancellationWindowHours: number }> {
  const query = new URLSearchParams({ reference, phone });
  const res = await fetch(`${API_BASE}/bookings/lookup?${query.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Could not find that booking');
  return json;
}

export async function cancelCustomerBooking(
  reference: string,
  phone: string
): Promise<{ success: boolean; message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE}/bookings/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, phone })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Could not cancel this booking');
  return json;
}

/**
 * Asks Laravel to open a Thawani checkout session. No amount is sent — the
 * server prices the booking itself, so the total can't be tampered with here.
 */
export async function createThawaniSession(bookingId: string): Promise<ThawaniCheckoutResponse> {
  const res = await fetch(`${API_BASE}/payments/thawani/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Thawani session initialization failed');
  return json;
}

/**
 * Reads the *verified* payment outcome after Thawani sends the customer back.
 * The landing URL proves nothing; Laravel re-checks with Thawani and this is
 * the only answer the UI trusts.
 */
export async function fetchPaymentResult(reference: string): Promise<PaymentResultResponse> {
  const res = await fetch(`${API_BASE}/payments/thawani/result?reference=${encodeURIComponent(reference)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Could not verify the payment');
  return json;
}

// Admin APIs
export async function fetchAdminCourts(): Promise<Court[]> {
  const res = await adminFetch('/admin/courts');
  if (!res.ok) throw new Error('Failed to fetch courts');
  return res.json();
}

export async function createAdminCourt(court: Partial<Court>): Promise<Court> {
  const res = await adminFetch('/admin/courts', {
    method: 'POST',
    body: JSON.stringify(court)
  });
  if (!res.ok) throw new Error('Failed to create court');
  return res.json();
}

export async function updateAdminCourt(id: string, updates: Partial<Court>): Promise<Court> {
  const res = await adminFetch(`/admin/courts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update court');
  return res.json();
}

export async function deleteAdminCourt(id: string): Promise<void> {
  const res = await adminFetch(`/admin/courts/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || 'Failed to delete court');
  }
}

export async function fetchAdminClosures(): Promise<CourtClosure[]> {
  const res = await adminFetch('/admin/closures');
  if (!res.ok) throw new Error('Failed to fetch closures');
  return res.json();
}

export async function createAdminClosure(closure: Partial<CourtClosure>): Promise<CourtClosure> {
  const res = await adminFetch('/admin/closures', {
    method: 'POST',
    body: JSON.stringify(closure)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to create court closure');
  return json;
}

export async function deleteAdminClosure(id: string): Promise<void> {
  const res = await adminFetch(`/admin/closures/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete closure');
}

export async function fetchAdminPricingRules(): Promise<TieredPricingRule[]> {
  const res = await adminFetch('/admin/pricing-rules');
  if (!res.ok) throw new Error('Failed to fetch pricing rules');
  return res.json();
}

export async function createAdminPricingRule(rule: Partial<TieredPricingRule>): Promise<TieredPricingRule> {
  const res = await adminFetch('/admin/pricing-rules', {
    method: 'POST',
    body: JSON.stringify(rule)
  });
  if (!res.ok) throw new Error('Failed to create pricing rule');
  return res.json();
}

export async function fetchAdminBookings(filters?: {
  courtId?: string;
  date?: string;
  status?: string;
  paymentMethod?: string;
  phone?: string;
}): Promise<Booking[]> {
  const query = new URLSearchParams();
  if (filters?.courtId) query.set('courtId', filters.courtId);
  if (filters?.date) query.set('date', filters.date);
  if (filters?.status) query.set('status', filters.status);
  if (filters?.paymentMethod) query.set('paymentMethod', filters.paymentMethod);
  if (filters?.phone) query.set('phone', filters.phone);

  const res = await adminFetch(`/admin/bookings?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
}

export async function cancelAdminBooking(id: string): Promise<Booking> {
  const res = await adminFetch(`/admin/bookings/${id}/cancel`, { method: 'POST' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to cancel booking');
  return json.booking;
}
