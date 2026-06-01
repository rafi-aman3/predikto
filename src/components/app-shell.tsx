import { Nav } from './nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Nav />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}
