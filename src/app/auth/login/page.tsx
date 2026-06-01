'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Login() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    // Onboarding gate (display-name check) runs server-side after redirect.
    router.push('/onboarding');
    router.refresh();
  }

  return (
    <div className="rp-card p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          className="border-2 border-pitch rounded-lg p-2"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border-2 border-pitch rounded-lg p-2"
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-alert text-sm">{error}</p>}
        <button className="bg-gold text-pitch font-bold rounded-lg py-2">
          {mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>
      </form>
      <button
        onClick={() => {
          setMode(mode === 'signup' ? 'signin' : 'signup');
          setError(null);
        }}
        className="mt-3 text-sm underline w-full"
      >
        {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create an account'}
      </button>
      {/* Google OAuth button slots in here in a later phase. */}
    </div>
  );
}
