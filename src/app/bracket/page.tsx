import { createClient } from '@/lib/supabase/server';
import { getBracketData } from '@/lib/get-bracket';
import { BracketSimulator } from '@/components/bracket/bracket-simulator';

export default async function BracketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await getBracketData(user?.id ?? null);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-cream text-2xl mb-4" style={{ textShadow: '2px 2px 0 #06231a' }}>
        Build your bracket
      </h1>
      {!user ? (
        <p className="rp-card p-4 text-pitch">Sign in to build and save your bracket.</p>
      ) : (
        <BracketSimulator data={data} signedIn />
      )}
    </main>
  );
}
