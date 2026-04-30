import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { UsuariosManager } from '@/components/configuracion/UsuariosManager';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session || session.rol !== 'admin') redirect('/dashboard');

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
