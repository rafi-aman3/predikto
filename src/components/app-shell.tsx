import { Nav } from './nav';
import { getAdminUser } from '@/lib/admin';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const isAdmin = !!(await getAdminUser());
  return (
    <div className="min-h-dvh">
      <Nav isAdmin={isAdmin} />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}
