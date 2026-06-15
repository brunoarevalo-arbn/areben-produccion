import { prisma } from '@/lib/prisma';
import { requirePagina } from '@/lib/page-guard';
import { UsuariosManager } from '@/components/configuracion/UsuariosManager';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const session = await requirePagina('usuarios');

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, username: true, rol: true, permisos: true, activo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Configuración</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Gestión de usuarios</h1>
        <p className="text-stone-500 text-sm mt-1">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}</p>
      </div>

      <UsuariosManager usuarios={usuarios} sesionId={session.id} />
    </div>
  );
}
