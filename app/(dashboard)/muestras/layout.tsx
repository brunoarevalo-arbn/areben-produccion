import { requirePaginaAlguno } from '@/lib/page-guard';

// Sección propia para que el permiso chico `muestras` alcance: quien retira tela
// no necesita (ni debería tener) todo Producción.
export default async function SeccionLayout({ children }: { children: React.ReactNode }) {
  await requirePaginaAlguno(['muestras', 'produccion']);
  return <>{children}</>;
}
