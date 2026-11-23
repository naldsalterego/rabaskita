// Booking protection policy for stays. Pure functions with no browser or server code, so the backend (which decides)
// and the pages (which preview) always agree.
//
// Catanduanes uses Philippine Standard Time (UTC+8, no daylight saving), so every deadline is in hotel local time.
// All amounts are in pesos and are the final price: room rates must already include taxes and mandatory fees.
export const TZ = 'Asia/Manila';
const OFFSET = '+08:00';
const H = 36e5;

export const POLICY = Object.freeze({
  guaranteeHours: 72,  // booked at least this far ahead: card on file, nothing charged, free cancellation until this many hours before check-in
  depositHours: 48,    // booked from here up to guaranteeHours ahead: deposit charged now; closer than this: the full amount
  reminderHours: 96,   // reminder (and card re-check) for card-guaranteed bookings
  depositRate: 0.5,
  lateFeeRate: 0.5,    // card-guaranteed bookings only: cancelling after the free-cancellation deadline, or a no-show, charges this share
  defaultCheckIn: '14:00',
  noShowAfter: '18:00', // an owner can mark a no-show only after this time on the check-in day
  replyWindowHours: 6,  // a request is never expired by the hotel's silence sooner than this, so late same-day bookings get a fair chance
});

export const TIERS = { guarantee: 'guarantee', deposit: 'deposit', full: 'full' };

const money = (n) => Math.round(n * 100) / 100;
export const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(new Date(s + 'T00:00:00Z').getTime());

/** The moment a guest is expected, as a Date. `date` is YYYY-MM-DD and `time` is HH:MM, both in hotel local time. */
export const arrivalAt = (date, time = POLICY.defaultCheckIn) => new Date(`${String(date).slice(0, 10)}T${time}:00${OFFSET}`);

/** Today's date (YYYY-MM-DD) in hotel local time. The UTC date is wrong for the first 8 hours of a Philippine day. */
export const localDate = (at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/** "Sun, Nov 29 · 2:00 PM" in hotel local time. */
export const localText = (iso) => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-PH', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
};

export const tierFor = (hours, rules = POLICY) => (hours >= rules.guaranteeHours ? TIERS.guarantee : hours >= rules.depositHours ? TIERS.deposit : TIERS.full);

/**
 * What a new booking of `total` pesos for `checkIn` owes right now.
 *   guarantee (72h or more ahead): nothing charged, free cancellation until 72h before check-in
 *   deposit   (48h up to 72h ahead): 50% charged now, non-refundable
 *   full      (under 48h, same day included): 100% charged now, non-refundable
 */
export function quote(total, checkIn, { rules = POLICY, time = rules.defaultCheckIn, at = new Date() } = {}) {
  const arrival = arrivalAt(checkIn, time), hours = (arrival - at) / H, tier = tierFor(hours, rules);
  const dueNow = tier === TIERS.guarantee ? 0 : tier === TIERS.deposit ? money(total * rules.depositRate) : money(total);
  const cancelUntil = tier === TIERS.guarantee ? new Date(arrival - rules.guaranteeHours * H).toISOString() : null;
  const reminderAt = tier === TIERS.guarantee && hours > rules.reminderHours ? new Date(arrival - rules.reminderHours * H).toISOString() : null;
  return { tier, hours, total: money(total), dueNow, balance: money(total - dueNow), refundable: tier === TIERS.guarantee, cancelUntil, reminderAt, arrival: arrival.toISOString() };
}

/** What happens to the money if the guest cancels `stay` now. `stay` is a stored booking. */
export function cancelTerms(stay, at = new Date(), rules = POLICY) {
  const paid = Number(stay.charged || 0);
  if (stay.status === 'pending') return { refund: paid, fee: 0, free: true, note: 'withdrawn' }; // the hotel has not accepted yet, so nothing was booked
  if (stay.policy_tier === TIERS.guarantee) {
    const free = at <= new Date(stay.free_cancel_until);
    return { refund: 0, fee: free ? 0 : money(stay.total * rules.lateFeeRate), free, note: free ? 'free' : 'late' };
  }
  return { refund: 0, fee: 0, free: false, note: 'forfeited', forfeited: paid };
}

/** Amount charged to the card on file when a card-guaranteed booking is a no-show. Deposits and full payments are simply kept. */
export const noShowFee = (stay, rules = POLICY) => (stay.policy_tier === TIERS.guarantee ? money(stay.total * rules.lateFeeRate) : 0);

/** An owner may mark a no-show only once the guest has had the whole check-in day to arrive. */
export const canMarkNoShow = (checkIn, at = new Date(), rules = POLICY) => at >= arrivalAt(checkIn, rules.noShowAfter);

/** Short plain-language summary of a quote, used on the booking page and in alerts. */
export function terms(q) {
  if (q.tier === TIERS.guarantee) return `No charge today. A valid card must be on file. Free cancellation until ${localText(q.cancelUntil)} (hotel local time). After that, cancelling or not showing up charges ${peso(money(q.total * POLICY.lateFeeRate))}.`;
  if (q.tier === TIERS.deposit) return `${peso(q.dueNow)} (50% of the stay) is charged now and is non-refundable. If you do not show up, the deposit is forfeited and nothing more is charged. The balance of ${peso(q.balance)} is paid at the property.`;
  return `${peso(q.dueNow)} (100% of the stay) is charged now and is non-refundable. If you do not show up, the full amount is forfeited.`;
}

// ---- Roam: vehicle rentals, tricycle commutes, and airport and port rides.
// Rentals use the same three tiers as stays (card on file, deposit, full payment), counted from the pick-up date at the pick-up time.
// A ride or commute is a short hop, so it has no deposit: a valid card is kept on file, the fare is paid to the driver at the end of
// the trip, and cancelling or not showing up after the free-cancellation time charges a share of the fare to that card.
export const ROAM = Object.freeze({
  rental: Object.freeze({ guaranteeHours: 72, depositHours: 48, reminderHours: 96, depositRate: 0.5, lateFeeRate: 0.5, defaultCheckIn: '08:00', noShowAfter: '10:00', replyWindowHours: 6 }),
  ride: Object.freeze({ freeCancelHours: 2, lateFeeRate: 0.5, noShowGraceMinutes: 15, replyWindowHours: 1 }),
  commute: Object.freeze({ maxKm: 30, detour: 1.35 }), // detour: roads are longer than the straight line between two points
  idRetentionDays: 30, // a guest's ID photo is deleted this many days after the booking is over
});
export const RIDE_TIER = 'ride';

/** What a rental of `total` pesos starting on `start` owes right now. Same tiers as a stay. */
export const rentalQuote = (total, start, opts = {}) => quote(total, start, { ...opts, rules: ROAM.rental });
export const rentalCancelTerms = (rental, at = new Date()) => cancelTerms(rental, at, ROAM.rental);
export const rentalNoShowFee = (rental) => noShowFee(rental, ROAM.rental);
export const canMarkRentalNoShow = (start, at = new Date()) => canMarkNoShow(start, at, ROAM.rental);

/** What a ride of `fare` pesos picking up at `pickupAt` (an ISO time) means for the guest. The fare itself is paid to the driver. */
export function rideQuote(fare, pickupAt, { at = new Date() } = {}) {
  const pickup = new Date(pickupAt), hours = (pickup - at) / H, cancelUntil = new Date(pickup - ROAM.ride.freeCancelHours * H).toISOString();
  return { tier: RIDE_TIER, hours, fare: money(fare), total: money(fare), dueNow: 0, lateFee: money(fare * ROAM.ride.lateFeeRate), cancelUntil, pickup: pickup.toISOString() };
}
/** What cancelling a stored ride costs. A request the driver has not accepted yet can always be withdrawn for free. */
export function rideCancelTerms(ride, at = new Date()) {
  if (ride.status === 'pending') return { fee: 0, free: true, note: 'withdrawn' };
  const free = at <= new Date(ride.free_cancel_until);
  return { fee: free ? 0 : money(ride.fare * ROAM.ride.lateFeeRate), free, note: free ? 'free' : 'late' };
}
export const rideNoShowFee = (ride) => money(ride.fare * ROAM.ride.lateFeeRate);
/** A driver may mark a no-show only after waiting a short grace period past the pick-up time. */
export const canMarkRideNoShow = (pickupAt, at = new Date()) => at >= new Date(new Date(pickupAt).getTime() + ROAM.ride.noShowGraceMinutes * 6e4);
