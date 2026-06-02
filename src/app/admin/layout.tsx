import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/');
  return <section>{children}</section>;
}
