// Business application form (fillable PDF), built in the browser from the current branding so the name and logos
// always match what the admin set under Admin > Branding. The Word version stays a fixed file.
import { photoUrl } from './photos.js';
// Same built-in logos as lib/branding.js (not imported from there so this file also loads under plain Node for tests).
const DEFAULT_LOGO = '/logo-rabaskita.png', DEFAULT_PARTNER = '/logo-islatek.png';

const NAVY = [37, 48, 143], MUTED = [92, 96, 134], CORAL = [242, 69, 45], LINE = [185, 188, 217], WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const W = 595.28, H = 841.89, L = 40, R = 555.28, COL2 = 304.6, HALF = 250.6;

// Loads a logo reference (built-in path, uploaded file or idb:...) as a PNG data URL plus its size. Returns null if it can't be read.
export async function loadLogo(ref) {
  try {
    const url = await photoUrl(ref); if (!url) return null;
    const blob = await (await fetch(url)).blob(), bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
    return { data: c.toDataURL('image/png'), w: bmp.width, h: bmp.height };
  } catch { return null; }
}

// brand: { siteName, tagline?, partnerBackdrop? }   logos: { site, partner } as returned by loadLogo (either may be missing)
export async function buildApplicationForm(brand, logos = {}) {
  const { jsPDF, AcroFormTextField, AcroFormCheckBox } = await import('jspdf');
  const name = (brand.siteName || '').trim() || 'Application', doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title: `${name} Business Application Form`, author: name, subject: `Application to be listed on ${name}` });
  const Y = (y) => H - y; // the layout below uses PDF-style coordinates (origin at the bottom left)
  const fill = (c) => doc.setFillColor(...c), stroke = (c) => doc.setDrawColor(...c), ink = (c) => doc.setTextColor(...c);
  const text = (x, y, s, { font = 'normal', size = 9, color = BLACK, align = 'left' } = {}) => { doc.setFont('helvetica', font); doc.setFontSize(size); ink(color); doc.text(s, x, Y(y), { align }); };

  let n = 0; const used = new Set();
  const uid = (base) => { let k = base, i = 2; while (used.has(k)) k = `${base}_${i++}`; used.add(k); return k; };
  function field(key, label, x, y, w, h = 17, multiline = false) {
    text(x, y + h + 3.3, label, { size: 7.8, color: MUTED });
    fill(WHITE); stroke(LINE); doc.setLineWidth(1); doc.rect(x, Y(y + h), w, h, 'FD');
    const f = new AcroFormTextField(); f.fieldName = uid(key); f.Rect = [x + 1, Y(y + h) + 1, w - 2, h - 2]; f.fontSize = 10; f.multiline = multiline;
    f.maxLength = multiline ? 1000 : 100; n++; doc.addField(f);
  }
  function check(key, label, x, yBox, dx = 18) {
    fill(WHITE); stroke(NAVY); doc.setLineWidth(1); doc.rect(x, Y(yBox + 11), 11, 11, 'FD');
    const f = new AcroFormCheckBox(); f.fieldName = uid(key); f.Rect = [x, Y(yBox + 11), 11, 11]; f.appearanceState = 'Off'; doc.addField(f);
    text(x + dx, yBox + 2.4, label, { size: 8.8 });
  }
  function bar(title, yBottom) { fill(NAVY); doc.roundedRect(L, Y(yBottom + 20), R - L, 20, 4, 4, 'F'); text(48, yBottom + 5.7, title, { font: 'bold', size: 10.5, color: WHITE }); }
  function footer(page) { text(L, 24.3, `${name} Business Application Form`, { size: 7.8, color: MUTED }); text(R, 24.3, `Page ${page}`, { size: 7.8, color: MUTED, align: 'right' }); }
  function logo(img, x, y, boxW, boxH) { // fit inside the box (y = bottom edge), centred
    if (!img) return; const k = Math.min(boxW / img.w, boxH / img.h), w = img.w * k, h = img.h * k;
    try { doc.addImage(img.data, 'PNG', x + (boxW - w) / 2, Y(y + (boxH - h) / 2 + h), w, h); } catch { /* skip a logo that can't be drawn */ }
  }

  // ---------------------------------------------------------------- page 1 header: site logo | IslaTek badge | title
  const hasSite = !!logos.site, hasPartner = !!logos.partner; let tx = L;
  if (hasSite) { logo(logos.site, L, 729, 70, 74); tx = 124; }
  if (hasPartner) {
    const bg = logos.backdrop || 'navy', x0 = hasSite ? 126 : L;
    if (hasSite) { stroke(LINE); doc.setLineWidth(1); doc.line(118, Y(740), 118, Y(796)); }
    if (bg === 'navy') { fill(NAVY); doc.roundedRect(x0, Y(797), 88, 60, 7, 7, 'F'); } else if (bg === 'white') { fill(WHITE); stroke(LINE); doc.roundedRect(x0, Y(797), 88, 60, 7, 7, 'FD'); }
    logo(logos.partner, x0 + 6, 743, 76, 48); tx = x0 + 88 + 18;
  }
  text(tx, 778.1, name, { font: 'bold', size: 18, color: NAVY });
  text(tx, 759.1, 'BUSINESS APPLICATION FORM', { font: 'bold', size: 13, color: CORAL });
  if (brand.tagline) text(tx, 743.9, brand.tagline, { font: 'italic', size: 9, color: MUTED });
  stroke(CORAL); doc.setLineWidth(2); doc.line(L, Y(719.9), R, Y(719.9));
  text(L, 706, 'Fill this out on your computer or print it and write by hand. Then give it, with copies of your documents, to the tourism office.', { size: 8.6 });
  text(L, 695, `The office adds your documents to your ${name} account and verifies them. Requirements may change; the office has the final say.`, { size: 8.6 });

  field('app_date', 'Date of application', L, 648, 150); field('app_no', 'Application no. (office use)', 210, 648, 170);
  bar('1. Type of business', 619.9);
  [['Stay: hotel, resort, inn, staycation, homestay', 599], ['Eat: restaurant, cafe, food stall', 581], ['Roam: vehicle rental or transport service', 563], ['Shop: souvenir shop or grocery', 545], ['Other: ______________________', 527]]
    .forEach(([label, y], i) => check(`type_${i}`, label, 44, y));
  bar('2. Business information', 495.9);
  field('biz_name', 'Business name', L, 458, HALF); field('trade_name', 'Trade / brand name (if different)', COL2, 458, HALF);
  field('address', 'Complete business address', L, 422, R - L);
  field('municipality', 'Municipality / barangay', L, 386, HALF); field('biz_phone', 'Business phone / mobile', COL2, 386, HALF);
  field('biz_email', 'Email address', L, 350, HALF); field('website', 'Facebook page / website', COL2, 350, HALF);
  field('year', 'Year started', L, 314, HALF); field('hours', 'Opening hours', COL2, 314, HALF);
  bar('3. Owner / authorized representative', 285.9);
  field('owner_name', 'Full name', L, 248, HALF); field('owner_position', 'Position', COL2, 248, HALF);
  field('owner_mobile', 'Mobile number', L, 212, HALF); field('owner_email', 'Email address', COL2, 212, HALF);
  field('owner_id', 'Valid government ID (type and number)', L, 176, R - L);
  bar('4. Registration details', 147.9);
  field('tin', 'BIR TIN', L, 110, HALF); field('bir_cor', 'BIR Certificate of Registration no.', COL2, 110, HALF);
  footer(1);

  // ---------------------------------------------------------------- page 2
  doc.addPage();
  field('reg_no', 'DTI / SEC / CDA registration no.', L, 769, HALF); field('permit_no', "Mayor's / business permit no.", COL2, 769, HALF);
  field('permit_valid', 'Permit valid until', L, 733, HALF); field('other_permits', 'Other permits / accreditations', COL2, 733, HALF);
  bar('5. What you offer', 704.9);
  [['• Stays: number of rooms/units, room types and price range', 695.1], ['• Eat: type of cuisine, price range, accepts table reservations (yes / no)', 684.1],
    ['• Roam: vehicles (type, seats), routes, rent per day with driver / self-drive', 673.1], ['• Shop: products sold', 662.1]].forEach(([s, y]) => text(44, y, s, { size: 7.6, color: MUTED }));
  field('offer_desc', 'Describe your business and what makes it special (this may appear on your listing)', L, 574, R - L, 62, true);
  bar('6. Documents to submit (attach clear copies)', 538.9);
  ['BIR Certificate of Registration (Form 2303)', 'Business registration: DTI (sole proprietor) / SEC (corporation) / CDA (cooperative)', "Mayor's / business permit (current year)",
    'Sanitary permit (food businesses and groceries)', 'Fire safety inspection certificate (stays and food businesses)', 'Transport franchise or permit and vehicle registration, OR/CR (transport and vehicle rentals)',
    'DOT accreditation, if you have one', 'Valid government ID of the owner or representative', 'Business logo and at least 3 clear photos for your listing'].forEach((d, i) => check(`doc_${i}`, d, 44, 518 - 18 * i));
  bar('7. Declaration and consent', 346.9);
  text(L, 337, `I certify that the information in this form and the documents I submit are true and correct. I understand that ${name} may verify`, { size: 8.1 });
  text(L, 325.5, `them, that my listing is shown only after the tourism office approves it, and that ${name} may publish my business details and`, { size: 8.1 });
  text(L, 314, 'whether my required documents are complete, expired or missing. I will keep my documents up to date.', { size: 8.1 });
  field('sign_name', 'Signature over printed name', L, 259.4, 300, 22); field('sign_date', 'Date', 370, 259.4, R - 370, 22);

  stroke(NAVY); doc.setLineWidth(1); doc.setLineDashPattern([4, 3], 0); doc.roundedRect(L, Y(246), R - L, 150, 8, 8, 'S'); doc.setLineDashPattern([], 0);
  text(50, 232.3, 'FOR OFFICE USE ONLY', { font: 'bold', size: 8.8, color: NAVY });
  field('off_recv_sign', 'Received by: IslaTek website manager (signature over printed name)', 50, 188, 300, 26); field('off_recv_date', 'Date received', 370, 188, 165, 26);
  field('off_rev', 'Reviewed by (tourism office)', 50, 148, 300); field('off_remarks', 'Remarks', 370, 148, 165);
  [['Approved', 50], ['For compliance', 160], ['Not approved', 270]].forEach(([label, x], i) => check(`dec_${i}`, label, x, 114, 16));
  footer(2);
  doc.fieldCount = n;
  return doc;
}

export const formFileName = (siteName) => { const base = (siteName || '').trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, ''); return `${base ? base + '-' : ''}Business-Application-Form.pdf`; };

export async function downloadApplicationForm(brand) {
  const [site, partner] = await Promise.all([loadLogo(brand.logo || DEFAULT_LOGO), loadLogo(brand.partnerLogo || DEFAULT_PARTNER)]);
  const doc = await buildApplicationForm(brand, { site, partner, backdrop: brand.partnerBackdrop || 'navy' });
  doc.save(formFileName(brand.siteName));
}
