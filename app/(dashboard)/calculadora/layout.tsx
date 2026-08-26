import { requirePaginaAlguno } from '@/lib/page-guard';

export default async function SeccionLayout({ children }: { children: React.ReactNode }) {
  await requirePaginaAlguno(['calculadora', 'costos']);
  return <>{children}</>;
}
