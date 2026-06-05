import { Nav } from './nav';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import { SfxProvider } from '@/components/retro/sound-toggle';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <SfxProvider>
      <div className="min-h-dvh">
        <Nav isAdmin={isAdminEmail(user?.email)} signedIn={!!user} />
        <main className="mx-auto max-w-3xl p-4">{children}</main>
      </div>
    </SfxProvider>
  );
}
