'use client';

import { NumInput } from '@/components/ui/NumInput';
import {
  escalarCurva, tiraPorTalle, type Tela, type TiraCurva, type MezclaTalle,
} from '@/lib/costos/escandallo';

const fmt$ = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const inp = 'w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-amber-400';

interface Props {
  tela: Tela;
  mezcla?: MezclaTalle[];
  onChange: (curva: TiraCurva | undefined) => void;
}

/**
 * El largo del ribete por TALLE. Se mide uno (el talle base, el que cosió la
 * costurera) y el resto se deriva por escalón. Un talle editado a mano queda
 * `manual` y la regla no lo pisa más.
 *
 * El costo se muestra por talle porque la merma NO es la misma en todos: la
 * parte de empaque (lo que sobra sin completar otra tira) depende del largo.
 */
export function CurvaTira({ tela, mezcla, onChange }: Props) {
  const curva = tela.curva;
  const largoBase = tela.largoTiraCm ?? 0;

  const crear = () => onChange({
    talleBase: '', pasoPercent: 4,
    talles: [{ talle: '', largoCm: largoBase }],
  });

  const set = (c: TiraCurva) => onChange(escalarCurva(c, largoBase));

  if (!curva) {
    return (
      <button type="button" onClick={crear}
        className="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-stone-200 text-stone-400 text-xs font-bold uppercase tracking-wide hover:border-amber-300 hover:text-amber-600 transition">
        + Curva por talle
      </button>
    );
  }

  const filas = tiraPorTalle(tela, mezcla);
  const pesoTotal = filas.reduce((s, f) => s + f.peso, 0);
  const costoPonderado = pesoTotal > 0 ? filas.reduce((s, f) => s + f.costo * f.peso, 0) / pesoTotal : 0;
  const filaBase = filas.find((f) => f.talle === curva.talleBase);

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Largo por talle</p>
        <button type="button" onClick={() => onChange(undefined)}
          className="text-xs text-stone-300 hover:text-red-500">quitar curva</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Talle base (el medido)</label>
          <select value={curva.talleBase} onChange={(e) => set({ ...curva, talleBase: e.target.value })}
            className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-amber-400">
            <option value="">— elegí —</option>
            {curva.talles.map((t) => <option key={t.talle} value={t.talle}>{t.talle || '(sin nombre)'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Crece por escalón</label>
          <NumInput value={curva.pasoCm ?? curva.pasoPercent ?? 0}
            onChange={(n) => set(curva.pasoCm != null ? { ...curva, pasoCm: n } : { ...curva, pasoPercent: n, pasoCm: undefined })}
            step="any" className={inp} />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Unidad</label>
          <div className="flex gap-1">
            {([['pct', '%'], ['cm', 'cm']] as const).map(([k, txt]) => {
              const activo = k === 'cm' ? curva.pasoCm != null : curva.pasoCm == null;
              return (
                <button key={k} type="button"
                  onClick={() => set(k === 'cm'
                    ? { ...curva, pasoCm: curva.pasoPercent ?? 0, pasoPercent: undefined }
                    : { ...curva, pasoPercent: curva.pasoCm ?? 0, pasoCm: undefined })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition ${activo ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-500'}`}>
                  {txt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-stone-400">
          <tr>
            <th className="text-left font-semibold pb-1">Talle</th>
            <th className="text-center font-semibold pb-1">Largo (cm)</th>
            <th className="text-right font-semibold pb-1">Merma</th>
            <th className="text-right font-semibold pb-1">Costo</th>
            <th className="text-right font-semibold pb-1">Peso</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {curva.talles.map((t, i) => {
            const fila = filas[i];
            const esBase = t.talle === curva.talleBase;
            return (
              <tr key={i} className={esBase ? 'bg-amber-50' : ''}>
                <td className="py-1 pr-2">
                  <input value={t.talle} placeholder="Ej: 2"
                    onChange={(e) => set({ ...curva, talles: curva.talles.map((x, k) => k === i ? { ...x, talle: e.target.value } : x) })}
                    className="w-20 border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                </td>
                <td className="py-1 px-2">
                  <NumInput value={t.largoCm} step="any" className={inp}
                    onChange={(n) => {
                      // Editar un talle a mano lo saca de la regla para siempre:
                      // una medición no la pisa un escalón calculado.
                      const talles = curva.talles.map((x, k) => k === i ? { ...x, largoCm: n, manual: !esBase } : x);
                      onChange(esBase ? escalarCurva({ ...curva, talles }, n) : { ...curva, talles });
                    }} />
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-stone-400 text-xs">
                  {fila ? `${fila.merma.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%` : '—'}
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-stone-700 font-medium">
                  {fila ? fmt$(fila.costo) : '—'}
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-stone-400 text-xs">{fila?.peso ?? 1}</td>
                <td className="py-1 pl-1 text-right">
                  {t.manual && <span className="text-xs text-amber-600 mr-1" title="Editado a mano: la regla no lo pisa">✎</span>}
                  <button type="button" aria-label="Quitar talle"
                    onClick={() => onChange({ ...curva, talles: curva.talles.filter((_, k) => k !== i) })}
                    className="text-stone-300 hover:text-red-500">✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button type="button"
        onClick={() => set({ ...curva, talles: [...curva.talles, { talle: '', largoCm: largoBase }] })}
        className="mt-2 text-xs text-stone-400 hover:text-amber-600 font-semibold">+ Agregar talle</button>

      <div className="mt-3 flex items-center gap-3 flex-wrap text-sm border-t border-stone-200 pt-3">
        <span className="text-xs text-stone-400">Costo del talle base:</span>
        <span className="font-mono tabular-nums text-stone-600">{filaBase ? fmt$(filaBase.costo) : '—'}</span>
        <span className="text-stone-300">→</span>
        <span className="text-xs text-stone-400">Costo ponderado (el que entra al total):</span>
        <span className="font-mono tabular-nums font-bold text-violet-700 ml-auto">{fmt$(costoPonderado)}</span>
      </div>
    </div>
  );
}
