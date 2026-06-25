'use client';

import { NumInput } from '@/components/ui/NumInput';

export interface AvioOpt { id: string; nombre: string; tipo: string | null; precio: number; stock: number | null; marca: string | null; frecuencia: string | null; }
export interface AvioSel { etiquetaId: string; cantidad: string; }

const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

// Selector de avíos por slots (etiqueta principal / composición / otros), filtrado por marca.
// Compartido entre el corte por orden y el corte por lote. El stock no se descuenta acá:
// solo se anota qué lleva la prenda; el movimiento ocurre al terminar la producción.
export function AviosSelector({
  aviosCatalogo, marca, aviosSel, setAviosSel, totalUnidades,
}: {
  aviosCatalogo: AvioOpt[];
  marca: string | null;
  aviosSel: AvioSel[];
  setAviosSel: React.Dispatch<React.SetStateAction<AvioSel[]>>;
  totalUnidades: number;
}) {
  const toggleAvio = (etiquetaId: string) =>
    setAviosSel((prev) => prev.find((a) => a.etiquetaId === etiquetaId)
      ? prev.filter((a) => a.etiquetaId !== etiquetaId)
      : [...prev, { etiquetaId, cantidad: '1' }]);
  const updateAvioCant = (etiquetaId: string, val: string) =>
    setAviosSel((prev) => prev.map((a) => a.etiquetaId === etiquetaId ? { ...a, cantidad: val } : a));
  // Slot fijo (principal/composición): reemplaza el avío de ese tipo por el elegido.
  const setSlotAvio = (tipoSlot: string, etiquetaId: string) =>
    setAviosSel((prev) => {
      const sinTipo = prev.filter((s) => (aviosCatalogo.find((a) => a.id === s.etiquetaId)?.tipo ?? '') !== tipoSlot);
      return etiquetaId ? [...sinTipo, { etiquetaId, cantidad: '1' }] : sinTipo;
    });
  const addOtroAvio = (etiquetaId: string) =>
    setAviosSel((prev) => prev.some((s) => s.etiquetaId === etiquetaId) ? prev : [...prev, { etiquetaId, cantidad: '1' }]);

  const renderAvio = (a: AvioOpt) => {
    const sel = aviosSel.find((x) => x.etiquetaId === a.id);
    const cantNum = sel ? (parseInt(sel.cantidad) || 0) : 0;
    return (
      <div key={a.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${sel ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
        <input type="checkbox" checked={!!sel} onChange={() => toggleAvio(a.id)} className="rounded border-stone-300 accent-amber-500" />
        <span className="text-xs text-stone-700 flex-1 truncate">{a.nombre}{a.tipo ? ` · ${a.tipo}` : ''}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${a.stock == null ? 'text-stone-400' : a.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {a.stock == null ? '∞' : `${a.stock} en stock`}
        </span>
        {sel && (
          <div className="flex items-center gap-1">
            <NumInput value={parseFloat(sel.cantidad) || 0} onChange={(n) => updateAvioCant(a.id, n ? String(n) : '')}
              min="1" step="1" placeholder="x prenda" className={`w-20 ${inpSm}`} />
            <span className="text-xs text-stone-400">/u</span>
            {totalUnidades > 0 && cantNum > 0 && (
              <span className="text-xs text-stone-400 ml-1 tabular-nums">= {cantNum * totalUnidades}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (aviosCatalogo.length === 0) {
    return <p className="text-sm text-stone-400 py-2">No hay avíos en el catálogo. Cargalos en Inventario → Catálogo → Avíos.</p>;
  }

  const catById = (id: string) => aviosCatalogo.find((a) => a.id === id);
  // Principal = etiqueta de la marca de la prenda. Composición = genérica (va en todas).
  // Otros = el resto (badanas, botones, cierres, tachas) de la marca + genéricos.
  const principales   = aviosCatalogo.filter((a) => a.tipo === 'principal' && (!a.marca || a.marca === marca));
  const composiciones = aviosCatalogo.filter((a) => a.tipo === 'composicion');
  const otros         = aviosCatalogo.filter((a) => a.tipo !== 'principal' && a.tipo !== 'composicion' && (!a.marca || a.marca === marca));
  const principalSel   = aviosSel.find((s) => catById(s.etiquetaId)?.tipo === 'principal');
  const composicionSel = aviosSel.find((s) => catById(s.etiquetaId)?.tipo === 'composicion');
  const otrosSel       = aviosSel.filter((s) => { const t = catById(s.etiquetaId)?.tipo; return t !== 'principal' && t !== 'composicion'; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Etiqueta principal</label>
          <select value={principalSel?.etiquetaId ?? ''} onChange={(e) => setSlotAvio('principal', e.target.value)} className={`${inpSm} w-full`}>
            <option value="">— Ninguna —</option>
            {principales.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.stock != null ? ` (${a.stock})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Etiqueta composición <span className="font-normal text-stone-400">(todas)</span></label>
          <select value={composicionSel?.etiquetaId ?? ''} onChange={(e) => setSlotAvio('composicion', e.target.value)} className={`${inpSm} w-full`}>
            <option value="">— Ninguna —</option>
            {composiciones.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.stock != null ? ` (${a.stock})` : ''}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-stone-600">Otros avíos <span className="font-normal text-stone-400">(cierres, tachas, badanas…)</span></span>
          {otros.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) addOtroAvio(e.target.value); }} className={`${inpSm} max-w-[16rem]`}>
              <option value="">+ Del catálogo</option>
              {otros.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.stock != null ? ` (${a.stock})` : ''}</option>)}
            </select>
          )}
        </div>
        {otrosSel.length === 0
          ? <p className="text-xs text-stone-400 italic">Sin otros avíos.</p>
          : <div className="space-y-2">{otrosSel.map((s) => { const a = catById(s.etiquetaId); return a ? renderAvio(a) : null; })}</div>}
      </div>
    </div>
  );
}
