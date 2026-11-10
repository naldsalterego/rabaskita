// Local demo mode: the shared backend core running in the browser, data in localStorage.
import { createBackend } from './backend.js';
import { deletePhoto, wipePhotos } from './photos.js';
const KEY = 'cat_demo_v2'; let cache = null;
const io = {
  token: () => localStorage.getItem('token'),
  load: async () => { if (!cache) { try { cache = JSON.parse(localStorage.getItem(KEY)); } catch { cache = null; } } return cache; },
  save: async (d) => { cache = d; localStorage.setItem(KEY, JSON.stringify(d)); },
  deletePhoto, wipePhotos,
};
const be = createBackend(io);
export const handle = be.handle, qrToken = be.qrToken;
export const resetDemo = () => { localStorage.clear(); wipePhotos(); location.href = '/'; };
