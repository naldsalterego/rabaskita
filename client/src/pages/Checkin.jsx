import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
export default function Checkin() {
  const { token } = useParams(); const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    if (!localStorage.getItem('token')) return setState({ status: 'login' });
    api('/checkin', { method: 'POST', body: { token } }).then(d => setState({ status: 'ok', points: d.points, place: d.place })).catch(e => setState({ status: 'error', msg: e.message }));
  }, [token]);
  return (<main className="mx-auto max-w-sm p-8 text-center">
    {state.status === 'loading' && <p>Checking your code…</p>}
    {state.status === 'login' && <p>Sign in to claim points. <Link className="underline" to="/login">Sign in</Link></p>}
    {state.status === 'ok' && <><h1 className="font-display text-3xl">You earned {state.points} points</h1>{state.place && <p className="mt-1">at <b>{state.place}</b></p>}<Link className="underline" to="/rewards">See rewards</Link></>}
    {state.status === 'error' && <p role="alert">{state.msg}</p>}
  </main>);
}
