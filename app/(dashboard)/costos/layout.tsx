import { requirePagina } from '@/lib/page-guard';

export default async function SeccionLayout({ children }: { children: React.ReactNode }) {
  await requirePagina('costos');
  return <>{children}</>;
}
