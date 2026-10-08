'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';
import { PROCESOS_DE_FALLA } from '@/lib/constants/lotes';
import type { ContextoFallas } from '@/lib/produccion/lotesPlanificados';

/**
 * "Registrar falla": piezas perdidas en un proceso, que la orden (o su lote) deja de esperar.
 * Es el MISMO formulario en Órdenes (⋮) y en la OP, y lee lo mismo que controla el servidor
 * (`contextoFallas`): a dónde puede ir y cuánto le queda a cada pieza y talle.
 *
 * ⛔ Sin defaults en pieza, talle ni proceso: los dice quien vio la falla. El lote sí se
 * elige solo cuando hay uno solo abierto (no hay nada que decidir).
 */
export function FallaForm({ ordenId, numeroFijo, onGuardado, onCancelar, tablet = false }: {
  ordenId: string;
  /** En la tablet de la costurera: botones grandes y su propia API (`/api/tiempos`). */
  tablet?: boolean;
  /** El lote desde el que se abrió (OP). `undefined` = se elige acá (Órdenes). */
  numeroFijo?: number | null;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [ctx, setCtx] = useState<ContextoFallas | null>(null);
  const [error, setError] = useState('');
  const [numero, setNumero] = useState<string>(numeroFijo === undefined ? '' : String(numeroFijo ?? ''));
  const [parte, setParte] = useState('');
  const [talle, setTalle] = useState('');
  const [cantidad, setCantidad] = useState(0);
  const [proceso, setProceso] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  // La costurera ⛔ tiene permiso de producción: la tablet entra por su API (mismo núcleo).
  const api = tablet ? `/api/tiempos/fallas/${ordenId}` : `/api/produccion/cola/${ordenId}/fallas`;

  useEffect(() => {
    let vivo = true;
    fetch(api)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) { setError(typeof d.error === 'string' ? d.error : 'No se pudo leer la orden'); return; }
        const c = d as ContextoFallas;
        setCtx(c);
        // Un solo destino posible: no hay nada que elegir.
        if (numeroFijo === undefined && c.destinos.length === 1) setNumero(String(c.destinos[0].numero ?? ''));
      })
      .catch(() => { if (vivo) setError('Sin conexión'); });
    return () => { vivo = false; };
  }, [api, numeroFijo]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!ctx) return <p className="text-xs text-stone-400">Cargando…</p>;
  if (ctx.destinos.length === 0) return <p className="text-xs text-stone-500">No queda nada sin ingresar: no hay dónde registrar una falla.</p>;

  const destino = ctx.destinos.find((d) => String(d.numero ?? '') === numero) ?? null;
  if (destino && destino.talles.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-700">Esta orden no tiene cargado cuánto se cortó por talle: sin eso no se puede decir qué talle falló. {tablet ? 'Avisale al taller.' : 'Cargá la ficha de corte.'}</p>
        <Button size={tablet ? 'lg' : 'sm'} variant="ghost" onClick={onCancelar}>Cerrar</Button>
      </div>
    );
  }
  const elegirLote = ctx.separada && numeroFijo === undefined;
  const queda = (t: string) => destino?.quedaPorParte[parte || '']?.find((x) => x.talle === t)?.cantidad;

  const guardar = async () => {
    if (ctx.separada && !destino) { toast.error('Elegí el lote'); return; }
    if (ctx.partes.length > 0 && !parte) { toast.error('Elegí la pieza que falló'); return; }
    if (!talle) { toast.error('Elegí el talle'); return; }
    if (!(cantidad > 0)) { toast.error('Cargá cuántas fallaron'); return; }
    if (!proceso) { toast.error('Elegí en qué proceso se perdieron'); return; }
    setGuardando(true);
    try {
      const r = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: destino?.numero ?? null, parte: parte || null, talle, cantidad, proceso, motivo: motivo.trim() || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(typeof d.error === 'string' ? d.error : 'No se pudo registrar la falla'); return; }
      toast.success(`Falla registrada: ${cantidad} ${parte ? parte.toLowerCase() + (cantidad > 1 ? 's' : '') + ' ' : ''}talle ${talle}`);
      onGuardado();
    } finally {
      setGuardando(false);
    }
  };

  const sel = tablet
    ? 'px-3 py-2.5 border-2 border-stone-200 rounded-xl text-sm bg-white'
    : 'px-2 py-1.5 border border-stone-200 rounded-lg text-xs bg-white';
  const chip = (activo: boolean) => `${tablet ? 'px-4 py-2.5 rounded-xl border-2 text-sm' : 'px-3 py-1.5 rounded-lg border text-xs'} font-semibold ${
    activo ? 'bg-red-100 border-red-400 text-red-800' : 'bg-white border-stone-200 text-stone-600'}`;
  return (
    <div className="space-y-2">
      {elegirLote && (
        <div className="flex flex-wrap gap-2">
          {ctx.destinos.map((d) => (
            <button key={String(d.numero)} type="button" onClick={() => setNumero(String(d.numero ?? ''))} aria-pressed={numero === String(d.numero ?? '')}
              className={chip(numero === String(d.numero ?? ''))}>
              Lote {d.numero}
            </button>
          ))}
        </div>
      )}
      {ctx.partes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ctx.partes.map((p) => (
            <button key={p} type="button" onClick={() => setParte(p)} aria-pressed={parte === p}
              className={chip(parte === p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select value={talle} onChange={(e) => setTalle(e.target.value)} aria-label="Talle" className={sel} disabled={!destino}>
          <option value="">— Talle —</option>
          {(destino?.talles ?? []).map((t) => {
            const q = queda(t.talle);
            return <option key={t.talle} value={t.talle}>{t.talle}{q !== undefined && (parte || ctx.partes.length === 0) ? ` (quedan ${q})` : ''}</option>;
          })}
        </select>
        <NumInput value={cantidad} onChange={(n) => setCantidad(n || 0)} aria-label="Cantidad" placeholder="Cantidad"
          className={`w-24 ${sel}`} />
        <select value={proceso} onChange={(e) => setProceso(e.target.value)} aria-label="Proceso" className={sel}>
          <option value="">— Dónde se perdieron —</option>
          {PROCESOS_DE_FALLA.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
          placeholder="Motivo (opcional)" className={`flex-1 min-w-40 ${sel}`} />
      </div>
      <div className="flex gap-2">
        <Button size={tablet ? 'lg' : 'sm'} variant={tablet ? 'danger' : 'primary'} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar falla'}</Button>
        <Button size={tablet ? 'lg' : 'sm'} variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>
      {ctx.fallas.length > 0 && (
        <p className="text-xs text-stone-500">
          Ya cargadas: {ctx.fallas.map((f) => `${f.cantidad} ${f.parte ? f.parte.toLowerCase() + ' ' : ''}${f.talle}${f.numero ? ` (L${f.numero})` : ''} · ${f.proceso}`).join(' — ')}
        </p>
      )}
    </div>
  );
}
