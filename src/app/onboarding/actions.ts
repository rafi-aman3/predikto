'use server';
import { createClient } from '@/lib/supabase/server';
import { setDisplayName } from '@/lib/profile';
import { redirect } from 'next/navigation';

export async function saveDisplayName(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const name = String(formData.get('displayName') ?? '').trim();
  if (name.length < 2) redirect('/onboarding');
  await setDisplayName(user.id, name);
  redirect('/');
}
