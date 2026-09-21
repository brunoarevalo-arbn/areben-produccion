'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';

interface PartePieza { nombre: string; sku: string | null; }
interface OrdenLite {
  id: string; sku: string | null; descripcion: string | null;
  /** Lo cortado y DE DÓNDE salió; `null` = todavía no hay corte ni plan con unidades. */
  base: { unidades: number; origen: 'cortado' | 'planificado' } | null;
  cortes: { talle: string; cantidad: number }[];
  /** Las piezas en que se parte la prenda (la bikini). `[]` = entra entera, como siempre. */
  partes: PartePieza[];
}
/** `porParte` sólo existe en las prendas por partes: una cantidad por pieza en la fila. */
interface Fila { talle: string; cantidad: string; porParte?: Record<string, string>; }

const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

// Prellena las filas de cada color desde su ficha de corte (talles cortados), editable.
function filasIniciales(o: OrdenLite): Fila[] {
  const base: Fila[] = o.cortes.length > 0
    ? o.cortes.map((c) => ({ talle: c.talle, cantidad: String(c.cantidad) }))
    : [{ talle: '', cantidad: '' }];
  if (o.partes.length === 0) return base;
  // Del corte salen las dos piezas, así que las dos arrancan con lo cortado — pero se
  // cuentan por separado, porque no tienen por qué salir iguales.
  return base.map((f) => ({ ...f, porParte: Object.fromEntries(o.partes.map((p) => [p.nombre, f.cantidad])) }));
}

const cantidadDe = (f: Fila, parte?: string) =>
  parseInt(parte ? (f.porParte?.[parte] ?? '') : f.cantidad) || 0;

export function TerminarLoteForm({ loteId, ordenes }: { loteId: string; ordenes: OrdenLite[] }) {
  const router = useRouter();
  const [conteo, setConteo] = useState<Record<string, Fila[]>>(
    () => Object.fromEntries(ordenes.map((o) => [o.id, filasIniciales(o)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // El freno por falta de ficha de corte se puede levantar, pero AFIRMÁNDOLO: la casilla
  // aparece recién cuando el servidor lo pide, para que nadie la tenga tildada por costumbre.
  const [pideAfirmar, setPideAfirmar] = useState(false);
  const [sinCosto, setSinCosto] = useState(false);

  const setFila = (ordenId: string, i: number, field: 'talle' | 'cantidad', val: string) =>
    setConteo((p) => ({ ...p, [ordenId]: p[ordenId].map((f, idx) => idx === i ? { ...f, [field]: val } : f) }));
  const setFilaParte = (ordenId: string, i: number, parte: string, val: string) =>
    setConteo((p) => ({ ...p, [ordenId]: p[ordenId].map((f, idx) => idx === i ? { ...f, porParte: { ...(f.porParte ?? {}), [parte]: val } } : f) }));
  const addFila = (ordenId: string) =>
    setConteo((p) => ({ ...p, [ordenId]: [...p[ordenId], { talle: '', cantidad: '' }] }));
  const rmFila = (ordenId: string, i: number) =>
    setConteo((p) => ({ ...p, [ordenId]: p[ordenId].filter((_, idx) => idx !== i) }));

  // 🔴 En una prenda por partes el total del color NO es la suma de las piezas: 40
  // corpiños + 40 bombachas son 40 bikinis del corte. Se muestra la pieza que MÁS entró
  // para decidir si el color se manda (>0), y el avance real lo define la que menos.
  const totalColor = (ordenId: string) => {
    const orden = ordenes.find((o) => o.id === ordenId);
    const filas = conteo[ordenId] || [];
    if (!orden || orden.partes.length === 0) return filas.reduce((s, f) => s + cantidadDe(f), 0);
    return Math.max(0, ...orden.partes.map((p) => filas.reduce((s, f) => s + cantidadDe(f, p.nombre), 0)));
  };

  const colores = ordenes.map((o) => ({ orden: o, total: totalColor(o.id) }));
  const completos = colores.filter((c) => c.total > 0);
  const totalGeneral = completos.reduce((s, c) => s + c.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (completos.length === 0) { setError('Cargá la cantidad que salió de al menos un color'); return; }

    const tallesDe = (ordenId: string, parte?: string) =>
      (conteo[ordenId] || [])
        .filter((f) => f.talle.trim() && cantidadDe(f, parte) > 0)
        .map((f) => ({ talle: f.talle.trim().toUpperCase(), cantidad: cantidadDe(f, parte) }));

    const payload = completos.map(({ orden }) => ({
      ordenId: orden.id,
      conteos: orden.partes.length > 0
        ? orden.partes
            .map((p) => ({ parte: p.nombre, talles: tallesDe(orden.id, p.nombre) }))
            .filter((c) => c.talles.length > 0)
        : [{ parte: null, talles: tallesDe(orden.id) }].filter((c) => c.talles.length > 0),
    }));
    // Un color marcado como "completo" pero sin talle nombrado no debe pasar
    if (payload.some((c) => c.conteos.length === 0)) { setError('Cada color cargado necesita talle y cantidad'); return; }

    setSaving(true);
    const r = await fetch(`/api/produccion/lote/${loteId}/terminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colores: payload, permitirSinCosto: sinCosto }),
    });
    if (r.ok) {
      router.back(); // volver al contexto anterior (no saltar a la portada)
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || 'Error al terminar');
      if (d.requiereAfirmar) setPideAfirmar(true);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-stone-500">
        Cargá lo que realmente salió de costura por color y talle (prellenado desde el corte). Ingresa al stock de
        terminados y descuenta los avíos. Los colores sin conteo se saltan y siguen en costura.
      </p>

      {colores.map(({ orden, total }) => {
        const filas = conteo[orden.id] || [];
        return (
          <div key={orden.id} className={`bg-white rounded-2xl border p-6 ${total > 0 ? 'border-emerald-200' : 'border-stone-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono font-bold text-sm px-2 py-1 rounded-lg bg-stone-100 text-stone-700">{orden.sku ?? 'S/SKU'}</span>
              {orden.descripcion && <span className="text-sm text-stone-500 truncate">{orden.descripcion}</span>}
              {/* El rótulo DICE cuál de los dos números es: "Cortadas" sobre lo planificado
                  afirma un corte que nadie cargó, y si difieren manda a comparar contra el
                  número equivocado. */}
              <span className="ml-auto text-xs text-stone-400">
                {orden.base
                  ? `${orden.base.origen === 'cortado' ? 'Cortadas' : 'Planificadas'}: ${orden.base.unidades}`
                  : 'Sin cantidad cargada'}
              </span>
            </div>

            {/* El corte produce DOS artículos: se cuentan por separado y cada uno entra
                a su propio SKU, que se MUESTRA antes de ingresar. */}
            {orden.partes.length > 0 && (
              <p className="text-xs text-stone-600 mb-3 bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                Se cose por partes y cada pieza se vende sola: van a{' '}
                {orden.partes.map((p, i) => (
                  <span key={p.nombre}>{i > 0 && ' y '}<span className="font-mono text-stone-800">{p.sku ?? '—'}</span></span>
                ))}
                . El avance del corte lo marca la pieza que menos entró.
              </p>
            )}

            {orden.partes.length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <span className="w-32 text-[11px] font-semibold text-stone-500">Talle</span>
                {orden.partes.map((p) => (
                  <span key={p.nombre} className="w-28 text-[11px] font-semibold text-stone-500">{p.nombre}</span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {filas.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={f.talle} onChange={(e) => setFila(orden.id, i, 'talle', e.target.value)} className={`${inpSm} w-32`}>
                    <option value="">Talle…</option>
                    {TALLES_DEFAULT.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {orden.partes.length > 0
                    ? orden.partes.map((p) => (
                        <NumInput key={p.nombre} value={cantidadDe(f, p.nombre)}
                          onChange={(n) => setFilaParte(orden.id, i, p.nombre, n ? String(n) : '')}
                          min="0" placeholder={p.nombre} className={`${inpSm} w-28`} />
                      ))
                    : (
                      <NumInput value={parseFloat(f.cantidad) || 0} onChange={(n) => setFila(orden.id, i, 'cantidad', n ? String(n) : '')}
                        min="0" placeholder="Cantidad" className={`${inpSm} w-28`} />
                    )}
                  {filas.length > 1 && (
                    <button type="button" aria-label="Quitar talle" onClick={() => rmFila(orden.id, i)}
                      className="text-stone-400 hover:text-red-500 px-1 text-lg leading-none">×</button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => addFila(orden.id)} className="text-xs text-amber-600 hover:text-amber-700 font-semibold">+ Agregar talle</button>
              <span className="text-xs">
                <span className="text-stone-500">Total: </span><strong className="text-stone-800">{total}</strong>
                {total === 0 && <span className="text-stone-400 ml-2">· se salta</span>}
              </span>
            </div>
          </div>
        );
      })}

      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6 flex items-center gap-8 text-sm">
        <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Colores</p><p className="text-stone-900 font-bold text-lg">{completos.length} / {ordenes.length}</p></div>
        <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Unidades a stock</p><p className="text-stone-900 font-bold text-lg">{totalGeneral}</p></div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

      {pideAfirmar && (
        <label className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
          <input type="checkbox" checked={sinCosto} onChange={(e) => setSinCosto(e.target.checked)} className="mt-0.5 accent-amber-600" />
          <span className="text-xs text-stone-700">
            Ingresar igual, <strong>sin costo de material</strong>. El lote queda marcado y su costo
            unitario va a tener sólo la mano de obra.
          </span>
        </label>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="lg" isLoading={saving} disabled={completos.length === 0 || (pideAfirmar && !sinCosto)}>
          {saving ? 'Terminando...' : `Terminar ${completos.length} ${completos.length === 1 ? 'color' : 'colores'}`}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  );
}
