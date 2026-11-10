import { useState } from 'react';
import { api } from '../lib/api.js';
import { useLoad, inp, btn } from './ui.jsx';
export default function Reviews({ type, id }) {
  const [d, reload] = useLoad(() => api(`/reviews?type=${type}&id=${id}`), [id]);
  const [rating, setRating] = useState(5); const [comment, setComment] = useState(''); const [msg, setMsg] = useState('');
  async function post(e) { e.preventDefault(); try { await api('/reviews', { method: 'POST', body: { type, id, rating: Number(rating), comment } }); setComment(''); setMsg('Thanks for your review.'); reload(); } catch (x) { setMsg(x.message.includes('Sign in') ? 'Sign in to leave a review.' : x.message); } }
  return (<section className="mt-6"><h2 className="font-display text-xl mb-1">Reviews{d?.average && ` · ${d.average}/5 (${d.count})`}</h2>
    {d && d.count === 0 && <p className="text-sm">No reviews yet.</p>}
    {d?.reviews.map((r, i) => <p key={i} className="text-sm py-1 border-b border-line"><b>{r.name}</b> · {r.rating}/5{r.comment && ` · ${r.comment}`}</p>)}
    <form onSubmit={post} className="flex flex-wrap gap-2 mt-3"><select className={inp} value={rating} onChange={e => setRating(e.target.value)} aria-label="Rating">{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} / 5</option>)}</select>
      <input className={`${inp} flex-1`} placeholder="Share your experience (optional)" value={comment} onChange={e => setComment(e.target.value)} /><button className={btn}>Post review</button></form>
    {msg && <p role="status" className="text-sm mt-2">{msg}</p>}</section>);
}
