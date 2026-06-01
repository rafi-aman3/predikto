import { createClient } from '@/lib/supabase/server';
import { getOrCreateProfile } from '@/lib/profile';
import { redirect } from 'next/navigation';
import { saveDisplayName } from './actions';

export default async function Onboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const profile = await getOrCreateProfile(user.id);
  if (profile.displayName) redirect('/'); // already onboarded

  return (
    <form
      action={saveDisplayName}
      className="rp-card p-6 max-w-sm mx-auto flex flex-col gap-3"
    >
      <h1 className="text-xl font-bold">Pick your name</h1>
      <input
        name="displayName"
        required
        minLength={2}
        maxLength={24}
        className="border-2 border-pitch rounded-lg p-2"
        placeholder="Display name"
      />
      <button className="bg-gold text-pitch font-bold rounded-lg py-2">Save</button>
    </form>
  );
}
