import { Link } from 'react-router-dom';
import { LogIn, Sparkles } from 'lucide-react';

/** Shown in the middle of the page when someone opens a page that needs an account. */
export default function SignInPrompt({ what = 'this page' }) {
  return (<main className="grid min-h-[55vh] place-items-center px-4 py-12">
    <section role="status" className="w-full max-w-md rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-ocean to-teal text-white"><LogIn size={26} /></span>
      <h1 className="mt-4 font-display text-3xl font-bold text-ocean">Please sign in</h1>
      <p className="mt-2 text-base text-ocean/75">Sign in to open {what}.</p>
      <div className="mt-6 grid gap-2">
        <Link to="/login" className="rounded-full bg-ocean py-3 font-medium text-foam hover:bg-teal">Sign in</Link>
        <Link to="/register" className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line py-3 text-sm font-medium hover:border-teal"><Sparkles size={15} className="text-tang" />New here? Create an account</Link>
      </div>
    </section></main>);
}
