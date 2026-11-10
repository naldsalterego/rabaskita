// Downloadable registry reports (CSV for Excel, PDF for printing).
const COLS = [['name', 'Business'], ['type', 'Type'], ['detail', 'Details'], ['municipality', 'Municipality'], ['address', 'Address'], ['phone', 'Phone'], ['owner', 'Owner'], ['email', 'Owner email'], ['status', 'Status'], ['registered', 'Registered'], ['papers', 'Papers'], ['papers_detail', 'Papers detail']];
export const PAPER_LABEL = { complete: 'Complete', review: 'Under review', incomplete: 'Incomplete' };
const cell = (k, v) => (k === 'papers' ? PAPER_LABEL[v] || v : v ?? '');
export function toCsv(rows) { const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return '\uFEFF' + [COLS.map(c => esc(c[1])).join(','), ...rows.map(r => COLS.map(([k]) => esc(cell(k, r[k]))).join(','))].join('\r\n'); }
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };
export const downloadCsv = (rows, name) => save(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), name);
export async function buildPdf(rows, meta = {}) {
  const { jsPDF } = await import('jspdf'), autoTable = (await import('jspdf-autotable')).default, doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(37, 48, 143); doc.text(meta.title || 'Registered businesses', 40, 44);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 94, 130);
  const f = meta.filters || {}, flt = [f.type && f.type !== 'all' ? `Type: ${f.type}` : null, f.status && f.status !== 'all' ? `Status: ${f.status}` : null, f.papers && f.papers !== 'all' ? `Papers: ${PAPER_LABEL[f.papers] || f.papers}` : null].filter(Boolean).join('   ') || 'All businesses';
  doc.text(`${flt}   ·   Generated ${new Date(meta.generated || Date.now()).toLocaleString()}`, 40, 60);
  const by = (k) => rows.filter(r => r.papers === k).length; doc.text(`Total: ${rows.length}   ·   Papers complete: ${by('complete')}   ·   Under review: ${by('review')}   ·   Incomplete: ${by('incomplete')}`, 40, 74);
  autoTable(doc, { startY: 86, margin: { left: 40, right: 40, bottom: 40 }, head: [['#', 'Business', 'Type', 'Municipality', 'Phone', 'Owner', 'Status', 'Registered', 'Papers']], body: rows.map((r, i) => [i + 1, r.name, r.type, r.municipality, r.phone, r.owner, r.status, r.registered, PAPER_LABEL[r.papers] || r.papers]),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' }, headStyles: { fillColor: [37, 48, 143], textColor: 255 }, alternateRowStyles: { fillColor: [243, 244, 251] }, columnStyles: { 0: { cellWidth: 24 } } });
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`${meta.title || 'Report'} · page ${i} of ${n}`, W - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' }); }
  return doc;
}
export async function downloadPdf(rows, meta) { const doc = await buildPdf(rows, meta); doc.save(meta.fileName || 'Business-Report.pdf'); }
