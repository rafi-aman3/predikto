'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function signOut() {
    start(async () => {
      await createClient().auth.signOut();
      router.push('/auth/login');
      router.refresh();
    });
  }

  return (
    <button
      onClick={signOut}
      disabled={pending}
      className="hover:text-gold disabled:opacity-60"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
