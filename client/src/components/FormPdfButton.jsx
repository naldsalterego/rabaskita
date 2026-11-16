import { useState } from 'react';
import { useBranding } from '../lib/branding.js';
// Builds the application form PDF on click, so it always shows the current site name and logos (Admin > Branding).
export default function FormPdfButton({ className, icon = null, children }) {
  const brand = useBranding(), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try { const { downloadApplicationForm } = await import('../lib/applicationForm.js'); await downloadApplicationForm(brand); }
    catch { setErr('Could not create the PDF. Please try again, or download the Word version.'); }
    setBusy(false);
  };
  return (<><button type="button" onClick={go} disabled={busy} className={className}>{icon}{busy ? 'Preparing…' : children}</button>{err && <p role="alert" className="text-center text-sm text-coral">{err}</p>}</>);
}
