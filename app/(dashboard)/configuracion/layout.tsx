import { requirePagina } from '@/lib/page-guard';

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  await requirePagina('configuracion');
  return <>{children}</>;
}
