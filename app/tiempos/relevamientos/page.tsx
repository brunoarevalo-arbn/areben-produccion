import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { corridasAbiertasDe } from '@/lib/calculadora/corridaDb';

export const dynamic = 'force-dynamic';

// La lista vive en su propia pantalla, no en la home de la tablet: con varios
// relevamientos cargados, la home quedaba larguísima y el registro del día se
// iba abajo de todo. Cuelga de /tiempos porque proxy.ts confina a la costurera
// a ese prefijo; el guard es manual, igual que en app/tiempos/page.tsx.
export default async function RelevamientosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const session = await verifySession(token);
  if (!session) redirect('/login');

  const corridas = await corridasAbiertasDe(session);

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="bg-stone-900 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">Relevamientos</p>
          <p className="text-white font-semibold text-sm leading-tight truncate">
            {corridas.length > 0 ? `${corridas.length} para medir` : 'No hay ninguno abierto'}
          </p>
        </div>
        <Link href="/tiempos"
          className="text-stone-400 hover:text-white text-xs border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition shrink-0">
          Volver
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {corridas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-400">
            <span className="text-3xl mb-2">📐</span>
            <p className="text-sm">Los relevamientos los carga Diseño desde la calculadora</p>
          </div>
        ) : (
          corridas.map((c) => (
            <Link key={c.id} href={`/tiempos/corrida/${c.id}`}
              className="block bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-4 transition active:scale-95">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 flex items-center gap-2">
                📐 {c.modo === 'relevamiento' ? 'Relevamiento' : 'Corrida de muestra'}
                {c.corriendo && (
                  <span className="text-red-600 normal-case tracking-normal">⏱ el reloj está corriendo</span>
                )}
                {!c.corriendo && c.estado === 'en_curso' && (
                  <span className="text-stone-400 normal-case tracking-normal">empezada</span>
                )}
              </p>
              <p className="font-semibold text-stone-900 text-base mt-0.5">
                {c.nombre} · {c.talle} <span className="text-amber-600">→</span>
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {c.costurera}
                {c.unidadesObjetivo > 1 && ` · prenda ${c.unidadActual} de ${c.unidadesObjetivo}`}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
