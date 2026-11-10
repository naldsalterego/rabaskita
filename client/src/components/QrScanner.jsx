import { useEffect, useRef, useState } from 'react';
import { SwitchCamera } from 'lucide-react';
import { decodeFrame } from '../lib/qr.js';
// Opens the camera and keeps looking for a QR code. Calls onCode(text) once, then stops the camera.
export default function QrScanner({ onCode, onProblem }) {
  const video = useRef(null), canvas = useRef(null), [facing, setFacing] = useState('environment'), [state, setState] = useState('starting');
  useEffect(() => {
    let stream, raf, done = false, last = 0;
    async function start() {
      if (!window.isSecureContext) { setState('insecure'); onProblem?.('The camera only works on a secure (https) page.'); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setState('nocamera'); onProblem?.('This browser cannot open the camera.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const v = video.current; if (!v) return; v.srcObject = stream; await v.play(); setState('running'); loop();
      } catch (e) { setState(e?.name === 'NotAllowedError' ? 'denied' : 'nocamera'); onProblem?.(e?.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow the camera for this site and try again.' : 'No camera was found.'); }
    }
    function loop(t = 0) {
      raf = requestAnimationFrame(loop); if (done || t - last < 110) return; last = t;
      const v = video.current, c = canvas.current; if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
      const k = Math.min(1, 720 / v.videoWidth), w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(v, 0, 0, w, h);
      const text = decodeFrame(ctx.getImageData(0, 0, w, h).data, w, h);
      if (text) { done = true; navigator.vibrate?.(120); stop(); onCode(text); }
    }
    function stop() { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); }
    start(); return () => { done = true; stop(); };
  }, [facing]); // eslint-disable-line
  return (<div className="relative overflow-hidden rounded-3xl bg-black">
    <video ref={video} playsInline muted autoPlay className="aspect-square w-full object-cover sm:aspect-[4/3]" /><canvas ref={canvas} className="hidden" />
    {state === 'running' && <><div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center"><div className="relative h-3/5 w-3/5 max-w-xs">{['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map(c => <span key={c} className={`absolute h-8 w-8 border-sun ${c}`} />)}<span className="absolute inset-x-2 top-1/2 h-0.5 animate-pulse bg-coral/80" /></div></div>
      <p className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white drop-shadow">Point the camera at the place's QR code</p>
      <button type="button" aria-label="Switch camera" onClick={() => setFacing(f => (f === 'environment' ? 'user' : 'environment'))} className="absolute right-3 top-3 rounded-full bg-black/50 p-2.5 text-white"><SwitchCamera size={20} /></button></>}
    {state === 'starting' && <p className="absolute inset-0 grid place-items-center text-white">Opening the camera… allow access if asked.</p>}
    {['denied', 'nocamera', 'insecure'].includes(state) && <p className="absolute inset-0 grid place-items-center p-6 text-center text-white">{state === 'denied' ? 'Camera access is blocked. Allow the camera in your browser settings, or use a photo or code below.' : state === 'insecure' ? 'The camera needs a secure (https) page. Use a photo or code below.' : 'No camera could be opened. Use a photo or code below.'}</p>}
  </div>);
}
