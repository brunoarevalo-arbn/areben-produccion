'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// La cola de etiquetas de lote que se van juntando para imprimir de a 4 por A4. Vive en el
// navegador de quien imprime: es la hoja que está armando esa compu, nada más.
const CLAVE = 'etiquetas-lote:hoja';
type Item = { id: string; numero: number };

function parsear(raw: string): Item[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x?.id === 'string' && Number.isInteger(x?.numero)) : [];
  } catch { return []; }
}
function guardar(items: Item[]) {
  try { localStorage.setItem(CLAVE, JSON.stringify(items)); } catch { /* sin storage: la hoja no se guarda */ }
  avisos.forEach((f) => f());
}
const leer = () => parsear(crudo());
const avisos = new Set<() => void>();
const suscribir = (f: () => void) => { avisos.add(f); window.addEventListener('storage', f); return () => { avisos.delete(f); window.removeEventListener('storage', f); }; };
const crudo = () => { try { return localStorage.getItem(CLAVE) ?? '[]'; } catch { return '[]'; } };
export const aParam = (items: Item[]) => items.map((i) => `${i.id}:${i.numero}`).join(',');

/** En la etiqueta suelta: sumarla a la hoja y ver cuántas lleva. */
export function SumarAHoja({ id, numero }: { id: string; numero: number }) {
  const items = parsear(useSyncExternalStore(suscribir, crudo, () => '[]'));
  const esta = items.some((i) => i.id === id && i.numero === numero);
  const alternar = () => {
    const actual = leer();
    const nuevo = esta ? actual.filter((i) => !(i.id === id && i.numero === numero)) : [...actual, { id, numero }];
    guardar(nuevo);
  };
  return (
    <div className="flex items-center gap-2">
      <button onClick={alternar}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${esta ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
        {esta ? '✓ En la hoja' : '+ Sumar a la hoja'}
      </button>
      {items.length > 0 && (
        <Link href={`/produccion/etiquetas?e=${aParam(items)}`} className="text-sm font-semibold text-amber-700 hover:underline">
          Ver hoja ({items.length})
        </Link>
      )}
    </div>
  );
}

/** En la hoja: si no vino la lista en la URL, la toma de la cola; y permite sacar o vaciar. */
export function ControlesHoja({ enUrl }: { enUrl: Item[] }) {
  const router = useRouter();
  useEffect(() => {
    if (enUrl.length === 0) {
      const cola = leer();
      if (cola.length > 0) router.replace(`/produccion/etiquetas?e=${aParam(cola)}`);
    }
  }, [enUrl.length, router]);

  const vaciar = () => { guardar([]); router.replace('/produccion/etiquetas?vacia=1'); };
  return (
    <button onClick={vaciar} className="px-4 py-2 rounded-xl text-sm font-semibold border border-stone-300 bg-white text-stone-700 hover:bg-stone-50">
      Vaciar hoja
    </button>
  );
}

export function SacarDeHoja({ id, numero, enUrl }: Item & { enUrl: Item[] }) {
  const router = useRouter();
  const sacar = () => {
    const nuevo = enUrl.filter((i) => !(i.id === id && i.numero === numero));
    guardar(nuevo);
    router.replace(nuevo.length ? `/produccion/etiquetas?e=${aParam(nuevo)}` : '/produccion/etiquetas?vacia=1');
  };
  return (
    <button onClick={sacar} className="text-xs text-stone-500 hover:text-red-600 print:hidden">✕ Sacar</button>
  );
}
