// Card handling for the sandbox. The card number and security code stay inside the browser: this file checks them and
// returns only a token plus the brand, last 4 digits and expiry. That is the same shape a real payment gateway
// (PayMongo, Xendit, Stripe...) gives back, so swapping one in later does not change the booking code.
//
// Sandbox cards:  4242 4242 4242 4242  works.   4000 0000 0000 0002  is declined.
//                 4000 0000 0000 0341  works at booking, then fails the re-check 96 hours before arrival.
export const SANDBOX_CARDS = [['4242 4242 4242 4242', 'works'], ['4000 0000 0000 0002', 'is declined'], ['4000 0000 0000 0341', 'fails the re-check before arrival']];

export const digits = (s) => String(s || '').replace(/\D/g, '');
export const groupCard = (s) => digits(s).slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

export function luhn(num) {
  let sum = 0, dbl = false;
  for (let i = num.length - 1; i >= 0; i--) { let d = +num[i]; if (dbl) { d *= 2; if (d > 9) d -= 9; } sum += d; dbl = !dbl; }
  return num.length > 0 && sum % 10 === 0;
}
export const brandOf = (n) => (/^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'Amex' : /^35/.test(n) ? 'JCB' : 'Card');

/** Check what the guest typed. Returns { card } (safe to send to the server) or { error }. */
export function tokenize({ number, exp, cvc }, now = new Date()) {
  const n = digits(number);
  if (n.length < 13 || n.length > 19 || !luhn(n)) return { error: 'That card number does not look right.' };
  const m = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/.exec(String(exp || '').trim());
  if (!m) return { error: 'Enter the expiry date as MM/YY.' };
  const expMonth = Number(m[1]), expYear = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (expMonth < 1 || expMonth > 12) return { error: 'The expiry month must be 01 to 12.' };
  if (expYear * 12 + expMonth < now.getFullYear() * 12 + now.getMonth() + 1) return { error: 'That card has expired.' };
  if (!/^\d{3,4}$/.test(String(cvc || '').trim())) return { error: 'Enter the 3 or 4 digit security code.' };
  const mode = n === '4000000000000002' ? 'declined' : n === '4000000000000341' ? 'lapse' : 'ok';
  return { card: { token: `sbx_${mode}_${n.slice(-4)}`, brand: brandOf(n), last4: n.slice(-4), expMonth, expYear } };
}

/** Server-side check of a card object from the client. Throws a guest-friendly message when it cannot be used. */
export function checkCard(c, checkIn) {
  const ok = c && /^sbx_(ok|declined|lapse)_\d{4}$/.test(String(c.token || '')) && /^\d{4}$/.test(String(c.last4 || '')) && Number.isInteger(c.expMonth) && c.expMonth >= 1 && c.expMonth <= 12 && Number.isInteger(c.expYear) && c.expYear >= 2000 && c.expYear <= 2200;
  if (!ok) throw new Error('A valid credit card is required to book.');
  if (c.token.startsWith('sbx_declined_')) throw new Error('Your card was declined. Please try another card.');
  if (new Date(Date.UTC(c.expYear, c.expMonth, 1)) <= new Date(String(checkIn).slice(0, 10) + 'T00:00:00Z')) throw new Error('That card expires before your check-in date. Please use another card.');
  return { token: c.token, brand: String(c.brand || 'Card').slice(0, 12), last4: c.last4, exp_month: c.expMonth, exp_year: c.expYear };
}
