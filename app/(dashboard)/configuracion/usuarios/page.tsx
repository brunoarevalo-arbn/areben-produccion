import { prisma } from '@/lib/prisma';
import { requirePagina } from '@/lib/page-guard';
import { UsuariosManager } from '@/components/configuracion/UsuariosManager';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const session = await requirePagina('usuarios');

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, username: true, rol: true, permisos: true, activo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="p-8">
      <PageHeader eyebrow="Configuración" title="Gestión de usuarios" subtitle={`${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} registrado${usuarios.length !== 1 ? 's' : ''}`} />

      <UsuariosManager usuarios={usuarios} sesionId={session.id} />
    </div>
  );
}
