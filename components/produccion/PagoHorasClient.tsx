'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NumInput } from '@/components/ui/NumInput';
import { LoadingState } from '@/components/ui/LoadingState';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { sumarDias, type ConfigPago, type ResultadoPeriodo, type Motivo } from '@/lib/produccion/pago-horas';

interface Costurera { id: string; nombre: string }
interface Respuesta {
  usuario: Costurera; config: ConfigPago; configGuardada: boolean;
  tarifas: { desde: string; montoHora: number }[];
  ajustes: { fecha: string; minutos: number; nota: string | null }[];
  desde: string; hasta: string; resultado: ResultadoPeriodo;
  cerrada: boolean; pagadoEl: string | null; difiereDeHoy: boolean; totalHoy: number;
  historial: { desde: string; hasta: string; totalMin: number; totalMonto: number; pagadoEl: string | null }[];
}

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const hm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
const fechaLarga = (f: string) => new Date(`${f}T00:00:00Z`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const fechaCorta = (f: string) => new Date(`${f}T00:00:00Z`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MOTIVO: Record<Motivo, string> = {
  tolerancia: 'Jornada completa (dentro de la tolerancia)', real: 'Lo trabajado', extra: 'Pasó la jornada',
  ajuste: 'Ajuste manual', sin_registros: 'Sin registros', dia_no_laboral: 'Día no laboral',
};
const input = 'h-9 rounded-lg border border-stone-200 px-2 text-sm focus:border-amber-400 focus:outline-none';

async function api(url: string, body?: unknown) {
  const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Error');
  return j;
}

export function PagoHorasClient() {
  const [costureras, setCostureras] = useState<Costurera[]>([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [rango, setRango] = useState<{ desde: string; hasta: string } | null>(null); // null = el período de hoy
  const [d, setD] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cfg, setCfg] = useState<ConfigPago | null>(null);
  const [verCfg, setVerCfg] = useState(false);
  const [tarifa, setTarifa] = useState({ desde: '', monto: 0 });
  const [ajuste, setAjuste] = useState<{ fecha: string; horas: string; nota: string } | null>(null);

  useEffect(() => {
    api('/api/produccion/pago-horas').then((j) => {
      setCostureras(j.costureras);
      if (j.costureras[0]) setUsuarioId(j.costureras[0].id); else setCargando(false);
    }).catch((e) => { toast.error(e.message); setCargando(false); });
  }, []);

  const cargar = useCallback(async () => {
    if (!usuarioId) return;
    setCargando(true);
    try {
      const q = new URLSearchParams({ usuarioId });
      if (rango) { q.set('desde', rango.desde); q.set('hasta', rango.hasta); }
      const j: Respuesta = await api(`/api/produccion/pago-horas?${q}`);
      setD(j); setCfg(j.config);
      setVerCfg((v) => v || !j.configGuardada);
    } catch (e) { toast.error((e as Error).message); } finally { setCargando(false); }
  }, [usuarioId, rango]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga desde la API, como el resto de las pantallas
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (body: Record<string, unknown>, ok?: string) => {
    try { await api('/api/produccion/pago-horas', { usuarioId, ...body }); if (ok) toast.success(ok); await cargar(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const ir = (paso: 1 | -1) => {
    if (!d) return;
    const dias = Math.round((new Date(`${d.hasta}T00:00:00Z`).getTime() - new Date(`${d.desde}T00:00:00Z`).getTime()) / 86400000) + 1;
    // Mensual: los días del mes vecino; el resto son bloques fijos de 7 o 14 días.
    if (d.config.periodo === 'MENSUAL') {
      const ref = paso === 1 ? sumarDias(d.hasta, 1) : sumarDias(d.desde, -1);
      const [y, m] = ref.split('-').map(Number);
      setRango({ desde: `${y}-${String(m).padStart(2, '0')}-01`, hasta: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) });
    } else if (paso === 1) setRango({ desde: sumarDias(d.hasta, 1), hasta: sumarDias(d.hasta, dias) });
    else setRango({ desde: sumarDias(d.desde, -dias), hasta: sumarDias(d.desde, -1) });
  };

  if (!costureras.length && !cargando) return <Card><p className="text-sm text-stone-500">No hay costureras activas.</p></Card>;
  const r = d?.resultado;
  const editable = !!d && !d.cerrada;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-stone-500">Costurera
          <select className={`${input} block mt-1`} value={usuarioId} onChange={(e) => { setUsuarioId(e.target.value); setRango(null); }}>
            {costureras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        {d && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => ir(-1)}>←</Button>
            <span className="text-sm font-semibold text-stone-800 min-w-44 text-center">{fechaCorta(d.desde)} al {fechaCorta(d.hasta)}</span>
            <Button variant="secondary" size="sm" onClick={() => ir(1)}>→</Button>
            {rango && <Button variant="ghost" size="sm" onClick={() => setRango(null)}>Hoy</Button>}
          </div>
        )}
      </div>

      {cargando && !d ? <LoadingState /> : d && r && cfg && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Corresponde pagar</p>
                <p className="text-3xl font-bold text-stone-900">{fmt$(r.totalMonto)}</p>
                <p className="text-sm text-stone-500">{hm(r.totalMin)} en {r.dias.filter((x) => x.pagadoMin > 0).length} días
                  {d.cerrada && <> · <b className="text-stone-700">{d.pagadoEl ? `pagado el ${new Date(d.pagadoEl).toLocaleDateString('es-AR')}` : 'cerrado, sin pagar'}</b></>}
                </p>
              </div>
              <div className="flex gap-2">
                {!d.cerrada && <Button onClick={async () => { if (await confirmAsync({ title: 'Cerrar período', message: `Se guarda el cálculo de ${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)} (${fmt$(r.totalMonto)}). Después cambiar la tarifa no lo mueve.`, confirmLabel: 'Cerrar' })) accion({ accion: 'cerrar', desde: d.desde, hasta: d.hasta }, 'Período cerrado'); }}>Cerrar período</Button>}
                {d.cerrada && !d.pagadoEl && <Button onClick={() => accion({ accion: 'pagado', desde: d.desde, hasta: d.hasta, pagado: true }, 'Marcado como pagado')}>Marcar pagado</Button>}
                {d.cerrada && !d.pagadoEl && <Button variant="secondary" onClick={() => accion({ accion: 'reabrir', desde: d.desde, hasta: d.hasta }, 'Período reabierto')}>Reabrir</Button>}
              </div>
            </div>
            {r.diasSinTarifa > 0 && <p className="mt-3 text-sm text-red-600">⚠ {r.diasSinTarifa} día(s) sin tarifa vigente: cargá la tarifa abajo, el monto de esos días está en $0.</p>}
            {d.difiereDeHoy && <p className="mt-3 text-sm text-amber-700">Este período está cerrado con {fmt$(r.totalMonto)}; con los datos de hoy daría {fmt$(d.totalHoy)}. Lo cerrado no se mueve.</p>}
          </Card>

          <Card padding="none">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-stone-500 border-b border-stone-200">
                <th className="px-4 py-2">Día</th><th className="px-2 py-2">Entrada</th><th className="px-2 py-2">Salida</th>
                <th className="px-2 py-2 text-right" title="El almuerzo y los descansos registrados; van incluidos en lo presente">Almuerzo/desc.</th><th className="px-2 py-2 text-right">Presente</th>
                <th className="px-2 py-2 text-right">Se paga</th><th className="px-2 py-2 text-right">Monto</th><th className="px-4 py-2">Cómo</th>
              </tr></thead>
              <tbody>
                {r.dias.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-stone-400">Sin registros en el período.</td></tr>}
                {r.dias.map((x) => (
                  <tr key={x.fecha} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-stone-800 capitalize">{fechaLarga(x.fecha)}</td>
                    <td className="px-2 py-2 text-stone-600">{x.entrada?.slice(0, 5) ?? '—'}</td>
                    <td className="px-2 py-2 text-stone-600">{x.salida?.slice(0, 5) ?? '—'}</td>
                    <td className="px-2 py-2 text-right text-stone-600">{x.pausasMin ? hm(x.pausasMin) : '—'}</td>
                    <td className="px-2 py-2 text-right text-stone-600">{x.trabajadoMin ? hm(x.trabajadoMin) : '—'}</td>
                    <td className="px-2 py-2 text-right font-semibold text-stone-900">{x.pagadoMin ? hm(x.pagadoMin) : '—'}{x.extraMin > 0 && <span className="text-xs text-amber-600"> (+{hm(x.extraMin)} extra)</span>}</td>
                    <td className="px-2 py-2 text-right text-stone-900">{x.pagadoMin ? fmt$(x.monto) : '—'}</td>
                    <td className="px-4 py-2 text-xs text-stone-500">
                      {MOTIVO[x.motivo]}{x.nota ? ` · ${x.nota}` : ''}
                      {editable && <button className="ml-2 text-amber-600 hover:underline" onClick={() => setAjuste({ fecha: x.fecha, horas: x.pagadoMin ? String(x.pagadoMin / 60).replace('.', ',') : '', nota: x.nota ?? '' })}>ajustar</button>}
                      {editable && x.motivo === 'ajuste' && <button className="ml-2 text-red-600 hover:underline" onClick={() => accion({ accion: 'borrar_ajuste', fecha: x.fecha })}>quitar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card padding="none">
            <div className="px-4 py-3 border-b border-stone-200 flex items-baseline justify-between">
              <p className="text-sm font-semibold text-stone-800">Historial de pagos</p>
              <p className="text-xs text-stone-500">{d.historial.length} períodos · {hm(d.historial.reduce((a, h) => a + h.totalMin, 0))} · {fmt$(d.historial.reduce((a, h) => a + h.totalMonto, 0))}</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-stone-500 border-b border-stone-200">
                <th className="px-4 py-2">Período</th><th className="px-2 py-2 text-right">Horas</th><th className="px-2 py-2 text-right">Monto</th><th className="px-4 py-2">Estado</th>
              </tr></thead>
              <tbody>
                {d.historial.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">Todavía no hay períodos cerrados.</td></tr>}
                {d.historial.map((h) => (
                  <tr key={h.desde} className="border-b border-stone-100 last:border-0 cursor-pointer hover:bg-stone-50" onClick={() => setRango({ desde: h.desde, hasta: h.hasta })}>
                    <td className="px-4 py-2 font-medium text-stone-800">{fechaCorta(h.desde)} al {fechaCorta(h.hasta)}</td>
                    <td className="px-2 py-2 text-right text-stone-600">{hm(h.totalMin)}</td>
                    <td className="px-2 py-2 text-right text-stone-900">{fmt$(h.totalMonto)}</td>
                    <td className="px-4 py-2 text-xs text-stone-500">{h.pagadoEl ? `Pagado el ${new Date(h.pagadoEl).toLocaleDateString('es-AR')}` : 'Cerrado, sin pagar'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {ajuste && editable && (
            <Card>
              <p className="text-sm font-semibold text-stone-800 mb-2">Ajuste manual del {fechaLarga(ajuste.fecha)} <span className="font-normal text-stone-500">(reemplaza el cálculo de ese día)</span></p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-stone-500">Horas a pagar<input className={`${input} block mt-1 w-28`} value={ajuste.horas} onChange={(e) => setAjuste({ ...ajuste, horas: e.target.value })} placeholder="ej. 7,5" /></label>
                <label className="text-xs text-stone-500 flex-1 min-w-48">Motivo<input className={`${input} block mt-1 w-full`} value={ajuste.nota} onChange={(e) => setAjuste({ ...ajuste, nota: e.target.value })} placeholder="ej. se fue una hora antes" /></label>
                <Button onClick={async () => { const h = parseFloat(ajuste.horas.replace(',', '.')); if (!(h >= 0)) return toast.error('Poné las horas'); await accion({ accion: 'ajuste', fecha: ajuste.fecha, minutos: Math.round(h * 60), nota: ajuste.nota }, 'Ajuste guardado'); setAjuste(null); }}>Guardar</Button>
                <Button variant="ghost" onClick={() => setAjuste(null)}>Cancelar</Button>
              </div>
            </Card>
          )}

          <Card>
            <p className="text-sm font-semibold text-stone-800 mb-2">Tarifa por hora</p>
            <ul className="text-sm text-stone-600 mb-3 space-y-0.5">
              {d.tarifas.length === 0 && <li className="text-red-600">Sin tarifa cargada.</li>}
              {d.tarifas.map((t) => <li key={t.desde}>{fmt$(t.montoHora)}/h desde el {fechaCorta(t.desde)}</li>)}
            </ul>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-stone-500">Nueva tarifa $/h<NumInput className={`${input} block mt-1 w-32`} value={tarifa.monto} onChange={(n) => setTarifa({ ...tarifa, monto: n })} /></label>
              <label className="text-xs text-stone-500">Rige desde<input type="date" className={`${input} block mt-1`} value={tarifa.desde} onChange={(e) => setTarifa({ ...tarifa, desde: e.target.value })} /></label>
              <Button variant="secondary" onClick={async () => { await accion({ accion: 'tarifa', montoHora: tarifa.monto, desde: tarifa.desde }, 'Tarifa guardada'); setTarifa({ desde: '', monto: 0 }); }}>Guardar tarifa</Button>
            </div>
            <p className="text-xs text-stone-400 mt-2">Cada día se paga con la tarifa que regía ese día; los períodos cerrados no cambian.</p>
          </Card>

          <Card>
            <button className="text-sm font-semibold text-stone-800" onClick={() => setVerCfg(!verCfg)}>{verCfg ? '▾' : '▸'} Cómo se calcula {!d.configGuardada && <span className="text-amber-600 font-normal">· sin guardar, se usan valores por defecto</span>}</button>
            {verCfg && (
              <div className="mt-4 space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <label className="text-xs text-stone-500">Jornada (horas)<NumInput className={`${input} block mt-1 w-full`} value={cfg.jornadaMin / 60} onChange={(n) => setCfg({ ...cfg, jornadaMin: Math.round(n * 60) })} /></label>
                  <label className="text-xs text-stone-500">Tolerancia (minutos)<NumInput className={`${input} block mt-1 w-full`} value={cfg.toleranciaMin} onChange={(n) => setCfg({ ...cfg, toleranciaMin: Math.round(n) })} /></label>
                  <label className="text-xs text-stone-500">Fracción de pago (minutos)<NumInput className={`${input} block mt-1 w-full`} value={cfg.fraccionMin} onChange={(n) => setCfg({ ...cfg, fraccionMin: Math.round(n) })} /></label>
                  <label className="text-xs text-stone-500">Redondeo
                    <select className={`${input} block mt-1 w-full`} value={cfg.redondeo} onChange={(e) => setCfg({ ...cfg, redondeo: e.target.value as ConfigPago['redondeo'] })}>
                      <option value="CERCANO">Al más cercano</option><option value="ABAJO">Para abajo</option><option value="ARRIBA">Para arriba</option>
                    </select></label>
                  <label className="text-xs text-stone-500">Recargo de horas extra (%)<NumInput className={`${input} block mt-1 w-full`} value={cfg.recargoExtraPct} onChange={(n) => setCfg({ ...cfg, recargoExtraPct: n })} /></label>
                  <label className="text-xs text-stone-500">Período de pago
                    <select className={`${input} block mt-1 w-full`} value={cfg.periodo} onChange={(e) => setCfg({ ...cfg, periodo: e.target.value as ConfigPago['periodo'] })}>
                      <option value="SEMANAL">Semanal</option><option value="QUINCENAL">Quincenal</option><option value="MENSUAL">Mensual</option>
                    </select></label>
                  {cfg.periodo === 'QUINCENAL' && <label className="text-xs text-stone-500">Primer día de una quincena<input type="date" className={`${input} block mt-1 w-full`} value={cfg.anclaPeriodo ?? ''} onChange={(e) => setCfg({ ...cfg, anclaPeriodo: e.target.value || null })} /></label>}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-stone-700">
                  <span className="text-xs text-stone-500">Días que se pagan:</span>
                  {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                    <label key={n} className="inline-flex items-center gap-1"><input type="checkbox" checked={cfg.diasSemana.includes(n)} onChange={(e) => setCfg({ ...cfg, diasSemana: e.target.checked ? [...cfg.diasSemana, n] : cfg.diasSemana.filter((x) => x !== n) })} />{DIAS[n]}</label>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={cfg.descuentaPausas} onChange={(e) => setCfg({ ...cfg, descuentaPausas: e.target.checked })} />Descontar el almuerzo y los descansos registrados del tramo entrada–salida</label>
                <p className="text-xs text-stone-400">Si lo trabajado queda a {cfg.toleranciaMin} min o menos de la jornada se paga la jornada completa; si falta más, lo trabajado en fracciones de {cfg.fraccionMin} min.</p>
                <Button onClick={() => accion({ accion: 'config', config: cfg }, 'Configuración guardada')}>Guardar configuración</Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
