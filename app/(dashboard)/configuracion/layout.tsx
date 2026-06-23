import { requirePaginaAlguno } from '@/lib/page-guard';

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  // Estas rutas viven bajo /configuracion pero ahora se acceden desde distintos
  // módulos (Proveedores → Compras, Cortadores/Motivos → Producción, Usuarios →
  // Configuración). El layout deja entrar si tiene ALGUNO de esos permisos; cada
  // página enforce el suyo propio.
  await requirePaginaAlguno(['configuracion', 'usuarios', 'proveedores', 'cortadores', 'motivos']);
  return <>{children}</>;
}
