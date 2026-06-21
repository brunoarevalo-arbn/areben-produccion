import { requirePaginaAlguno } from '@/lib/page-guard';

export default async function ComprasLayout({ children }: { children: React.ReactNode }) {
  await requirePaginaAlguno(['insumos', 'gastos']);
  return <>{children}</>;
}
