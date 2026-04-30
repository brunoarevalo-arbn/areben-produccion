import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { CatalogoManager } from '@/components/configuracion/CatalogoManager';

export const dynamic = 'force-dynamic';

export default async function TelasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  const items = await prisma.telaCatalogo.findMany({ orderBy: { nombre: 'asc' } });

  return (
    <div className="p-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Configuración</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Catálogo de Telas</h1>
        <p className="text-stone-500 text-sm mt-1">{items.length} tela{items.length !== 1 ? 's' : ''} registrada{items.length !== 1 ? 's' : ''}</p>
      </div>
      <CatalogoManager
        items={items.map((i) => ({ id: i.id, nombre: i.nombre }))}
        apiBase="/api/telas-catalogo"
        label="tela"
        placeholder="Ej: Algodón 100%, Jersey de lycra..."
      />
    </div>
  );
}
