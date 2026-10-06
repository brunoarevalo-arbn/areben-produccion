'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { PUNTOS_DE_SEPARACION, DESPUES_DE_LOTE_1, MAQUINA_DEL_PROCESO, textoTalles } from '@/lib/constants/lotes';

interface Talle { talle: string; cantidad: number }
export interface LoteParaCard {
  id: string;
  numero: number;
  despuesDe: string;
  separadoAt: string;
  talles: Talle[];
  unidades: number;
  ingresado: number;
  abierto: boolean;
  /** null = programado: espera que la costurera confirme en la tablet. */
  activadoAt: string | null;
  enTaller: boolean;
  /** Minutos de la tablet marcados con este lote. */
  minutos: number;
}

const fmtMin = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: n < 10 ? 1 : 0 });

/**
 * "Lotes de producción" del detalle de la OP: el corte separado en bolsas ("Lote 1 / Lote 2")
 * para etiquetarlas y que la tablet marque los minutos de cada una. Ver
 * `lib/produccion/lotesPlanificados.ts`.
 *
 * Sin lotes, la orden es un solo lote y se ofrece separar. Lo que se puede separar es lo
 * que al Lote 1 le queda SIN INGRESAR, talle por talle: el servidor lo vuelve a controlar.
 */
export function LotesPlanificados({ ordenId, sku, enCostura, puedeProgramar, lotes, tallesCortados, minutosSinLote, etiquetaQs }: {
  ordenId: string;
  sku: string | null;
  enCostura: boolean;
  /** Antes de costura (o en costura) se puede dejar programada la separación. */
  puedeProgramar: boolean;
  lotes: LoteParaCard[];
  /** Lo cortado por talle (el Lote 1 implícito de una orden sin separar). `null` = no se sabe. */
  tallesCortados: Talle[] | null;
  /** Minutos de la tablet sin lote: se reparten entre los lotes por unidades. */
  minutosSinLote: number;
  etiquetaQs: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [despuesDe, setDespuesDe] = useState('');
  // 'ahora' | 'programado'. ⛔ Sin default: separar ya y programar son cosas distintas.
  const [cuando, setCuando] = useState<'' | 'ahora' | 'programado'>('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const separada = lotes.length > 0;
  const programada = lotes.some((l) => l.numero > 1 && !l.activadoAt);
  const algunoVisible = lotes.some((l) => l.activadoAt && l.enTaller && l.abierto);
  const lote1 = lotes.find((l) => l.numero === 1);
  // Lo separable: lo del Lote 1 que todavía no entró. Sin separar, es todo lo cortado.
  // ⚠️ Lo ya ingresado sin separar lo descuenta el servidor; acá se muestra el corte.
  const disponibles: Talle[] = lote1 ? lote1.talles : (tallesCortados ?? []);
  const totalSeparar = Object.values(cantidades).reduce((s, n) => s + (n || 0), 0);
  const ultimo = lotes.length > 1 ? Math.max(...lotes.map((l) => l.numero)) : null;

  const abrir = () => { setCantidades({}); setDespuesDe(''); setCuando(enCostura ? '' : 'programado'); setError(''); setAbierto(true); };

  const separar = async () => {
    setError('');
    const talles = disponibles.map((t) => ({ talle: t.talle, cantidad: cantidades[t.talle] || 0 })).filter((t) => t.cantidad > 0);
    if (talles.length === 0) { setError('Cargá cuántas van al lote nuevo'); return; }
    if (!despuesDe) { setError('Elegí después de qué proceso se separa'); return; }
    if (!cuando) { setError('Elegí si se separa ahora o cuando la costurera termine el proceso'); return; }
    setGuardando(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/lotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talles, despuesDe, programado: cuando === 'programado' }),
    });
    setGuardando(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(typeof d.error === 'string' ? d.error : 'No se pudo separar');
      return;
    }
    setAbierto(false);
    toast.success(cuando === 'programado'
      ? `Programado: se separa cuando la costurera confirme que terminó el ${despuesDe.toLowerCase()}.`
      : 'Lote separado. Imprimí las etiquetas de las bolsas.');
    router.refresh();
  };

  const patch = async (body: object, error: string) => {
    const r = await fetch(`/api/produccion/cola/${ordenId}/lotes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(typeof d.error === 'string' ? d.error : error);
      return;
    }
    router.refresh();
  };

  const deshacer = async (numero: number) => {
    if (!(await confirmAsync({ message: `¿Deshacer el Lote ${numero}? Sus talles vuelven al Lote 1.`, danger: true, confirmLabel: 'Deshacer' }))) return;
    const r = await fetch(`/api/produccion/cola/${ordenId}/lotes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(typeof d.error === 'string' ? d.error : 'No se pudo deshacer');
      return;
    }
    router.refresh();
  };

  return (
    <Card padding="none" className="p-6 mb-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-bold text-stone-800">Lotes de producción</h3>
        {(enCostura || puedeProgramar) && disponibles.length > 0 && !abierto && !programada && (
          <Button size="sm" variant="secondary" onClick={abrir}>Separar lote</Button>
        )}
      </div>
      <p className="text-xs text-stone-500 mb-3">
        {separada
          ? (programada
              ? 'La separación está programada: hasta que la costurera confirme en la tablet que terminó el proceso, la orden es un solo lote y todo lo cosido se reparte entre los lotes por unidades.'
              : 'Cada lote visible (👁) es su propia fila en la tablet y la costurera toca la bolsa que tiene. Ocultá (🙈) el que no quieras que cosa. Los minutos sin lote (los de antes de separar) se reparten entre los lotes por unidades.')
          : 'Este corte es un solo lote. Si en el taller hay que separar una parte —con todo cortado, después del remallado…—, separala acá: cada bolsa lleva su etiqueta y la tablet le marca los minutos.'}
      </p>

      {!separada && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-stone-800">Lote 1 de 1</span>
          <span className="text-xs text-stone-500">{tallesCortados ? textoTalles(tallesCortados) : 'sin talles cargados'}</span>
          {tallesCortados && (
            <Link href={`/produccion/${ordenId}/lote/1/etiqueta${etiquetaQs}`} className="ml-auto text-xs text-amber-600 hover:underline">Etiqueta</Link>
          )}
        </div>
      )}

      {separada && (
        <div className="space-y-2">
          {lotes.map((l) => (
            <div key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm border-b border-stone-100 pb-2 last:border-0">
              <span className="font-semibold text-stone-800 w-24">Lote {l.numero} <span className="font-normal text-stone-400">de {lotes.length}</span></span>
              <span className="text-xs text-stone-600">{textoTalles(l.talles)} = <strong>{l.unidades} u</strong></span>
              <span className="text-xs text-stone-400">
                {l.despuesDe === DESPUES_DE_LOTE_1 ? 'el resto del corte' : `separado después de ${l.despuesDe}`}
              </span>
              <span className={`text-xs ${l.abierto ? 'text-stone-500' : 'text-emerald-700 font-semibold'}`}>
                ingresado {l.ingresado}/{l.unidades}
              </span>
              <span className="text-xs text-stone-400">{fmtMin(l.minutos)} min marcados</span>
              {!programada && l.abierto && (
                <span className={`text-xs font-semibold ${l.enTaller ? 'text-emerald-700' : 'text-stone-400'}`}>
                  {l.enTaller ? 'la ven en la tablet' : 'oculto'}
                </span>
              )}
              {programada && l.numero > 1 && (
                <span className="text-xs font-semibold text-sky-700">programado</span>
              )}
              <span className="ml-auto flex gap-3">
                {!programada && l.abierto && enCostura && (
                  <button type="button" onClick={() => patch({ numero: l.numero, enTaller: !l.enTaller }, 'No se pudo cambiar')}
                    title={l.enTaller ? 'La ven en la tablet — tocá para ocultarlo' : 'Oculto — tocá para que lo vean'}
                    className={`text-sm px-2 py-0.5 rounded-lg border leading-none ${l.enTaller ? 'border-stone-200 hover:bg-stone-50' : 'border-amber-300 bg-amber-50'}`}>
                    {l.enTaller ? '👁' : '🙈'}
                  </button>
                )}
                {l.numero === ultimo && (enCostura || programada) && l.ingresado === 0 && (
                  <button type="button" onClick={() => deshacer(l.numero)} className="text-xs text-stone-400 hover:text-red-600">Deshacer</button>
                )}
                <Link href={`/produccion/${ordenId}/lote/${l.numero}/etiqueta${etiquetaQs}`} className="text-xs text-amber-600 hover:underline">Etiqueta</Link>
              </span>
            </div>
          ))}
          {programada && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg p-2.5">
              <span>
                Se activa cuando la costurera, al dejar la {MAQUINA_DEL_PROCESO[lotes.find((l) => l.numero > 1 && !l.activadoAt)?.despuesDe ?? '']?.toLowerCase() ?? 'máquina'},
                confirme en la tablet que terminó. Al activarse, el Lote 1 queda visible y el resto oculto.
              </span>
              {enCostura && (
                <button type="button" onClick={() => patch({ activar: true }, 'No se pudo activar')}
                  className="ml-auto font-semibold text-sky-700 hover:underline">Activar ahora</button>
              )}
            </div>
          )}
          {!programada && !algunoVisible && lotes.some((l) => l.abierto) && (
            <p className="text-xs text-amber-700">Todos los lotes están ocultos: la orden no aparece en la tablet.</p>
          )}
          {minutosSinLote > 0 && (
            <p className="text-xs text-stone-500 pt-1">
              {fmtMin(minutosSinLote)} min de {sku ?? 'esta orden'} no tienen lote: se reparten entre los lotes por unidades.
            </p>
          )}
        </div>
      )}

      {abierto && (
        <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
          <p className="text-xs font-semibold text-stone-700">
            ¿Cuántas van al Lote {separada ? Math.max(...lotes.map((l) => l.numero)) + 1 : 2}? Salen del Lote 1.
          </p>
          <div className="flex flex-wrap gap-3">
            {disponibles.map((t) => (
              <label key={t.talle} className="text-xs text-stone-500">
                {t.talle} <span className="text-stone-400">(de {t.cantidad})</span>
                <NumInput min="0" max={String(t.cantidad)} value={cantidades[t.talle] || 0}
                  onChange={(n) => setCantidades((p) => ({ ...p, [t.talle]: n || 0 }))}
                  className="mt-0.5 w-20 px-2 py-1.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-400" />
              </label>
            ))}
          </div>
          <label className="block text-xs text-stone-500">
            Se separa después de
            {/* ⛔ Sin valor por default: un punto que pone la pantalla no lo dijo nadie. */}
            <select value={despuesDe} onChange={(e) => setDespuesDe(e.target.value)}
              className="mt-0.5 block w-56 px-2 py-1.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-400">
              <option value="">— Elegí —</option>
              {PUNTOS_DE_SEPARACION.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <fieldset className="text-xs text-stone-600 space-y-1">
            <legend className="text-stone-500 mb-1">¿Cuándo rige?</legend>
            <label className={`flex items-center gap-2 ${enCostura ? '' : 'opacity-40'}`}>
              <input type="radio" name="cuando" disabled={!enCostura} checked={cuando === 'ahora'} onChange={() => setCuando('ahora')} className="accent-amber-600" />
              Ahora — el proceso ya terminó
            </label>
            <label className={`flex items-center gap-2 ${despuesDe && !MAQUINA_DEL_PROCESO[despuesDe] ? 'opacity-40' : ''}`}>
              <input type="radio" name="cuando" disabled={!!despuesDe && !MAQUINA_DEL_PROCESO[despuesDe]} checked={cuando === 'programado'}
                onChange={() => setCuando('programado')} className="accent-amber-600" />
              Cuando la costurera deje la {despuesDe && MAQUINA_DEL_PROCESO[despuesDe] ? MAQUINA_DEL_PROCESO[despuesDe].toLowerCase() : 'máquina'} y confirme en la tablet que terminó
            </label>
          </fieldset>
          {totalSeparar > 0 && (
            <p className="text-xs text-stone-600">
              Lote nuevo: <strong>{totalSeparar} u</strong> · el Lote 1 queda con{' '}
              <strong>{disponibles.reduce((s, t) => s + t.cantidad, 0) - totalSeparar} u</strong>.
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" isLoading={guardando} onClick={separar}>Separar</Button>
            <Button size="sm" variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
