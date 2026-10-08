'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Etapa, Tablero as TableroData, TableroArticulo, TableroOrden } from '@/lib/produccion/tablero';
import { toast } from '@/components/ui/Toaster';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PanelOrden } from './PanelOrden';
import { CHIP, CHIP_TONO, avisosDe, horasMin, lotesVista, num, pesos, type LoteVista } from './formato';
import { LoteBoton } from './Lote';
import { Geo } from './Geometral';
import { MenuAcciones, ModalIngresar, useAccionesLote, useAccionesOrden } from './Acciones';
import { NuevaProduccion } from './NuevaProduccion';

// El tablero de Producción › Órdenes (rediseño oct-2026): es la pantalla de Órdenes; la
// cola de antes (ColaAdmin) queda en `?vista=anterior`.
const VOLVER = '/produccion';

const ETAPAS: { etapa: Etapa; titulo: string; bajada: string; vacio?: string }[] = [
  { etapa: 'corte', titulo: 'Corte', bajada: 'Creadas, asignadas o esperando el corte', vacio: 'No hay nada esperando corte.' },
  { etapa: 'taller', titulo: 'En el taller', bajada: 'Lo que se está cosiendo' },
  { etapa: 'paraCerrar', titulo: 'Para cerrar', bajada: 'Cosidas, falta ingresar o cerrar' },
  { etapa: 'frenada', titulo: 'Frenadas', bajada: 'Fuera de la tablet hasta que llegue lo que falta' },
];

export function Tablero() {
  const [data, setData] = useState<TableroData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [espera, setEspera] = useState<TableroOrden | null>(null);
  const [nueva, setNueva] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/produccion/tablero', { cache: 'no-store' });
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? 'No se pudo cargar el tablero'); return; }
    setError(null);
    setData(await r.json());
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API, como el resto de las pantallas
  useEffect(() => { cargar(); }, [cargar]);

  const ordenes = useMemo(() => data?.articulos.flatMap((a) => a.ordenes) ?? [], [data]);
  const seleccionada = ordenes.find((o) => o.id === sel) ?? null;

  // Ojo de un lote planificado: lo muestra u oculta en la tablet (mismo endpoint que la cola).
  const moverLote = async (o: TableroOrden, numero: number, enTaller: boolean) => {
    const r = await fetch(`/api/produccion/cola/${o.id}/lotes`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero, enTaller }),
    });
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo cambiar el lote'); return; }
    toast.success(`${o.color} · Lote ${numero}: ${enTaller ? 'se ve en la tablet' : 'oculto de la tablet'}`);
    cargar();
  };
  // Una orden sin separar se oculta poniéndola EN ESPERA, con motivo ("falta dije").
  const retomar = async (o: TableroOrden) => {
    const r = await fetch(`/api/produccion/cola/${o.id}/espera`, { method: 'DELETE' });
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo retomar'); return; }
    toast.success(`${o.color}: vuelve a la tablet`);
    cargar();
  };
  const alternar = (o: TableroOrden, l: LoteVista) => {
    if (!l.unico) return moverLote(o, l.numero, !l.enTablet);
    if (o.enEspera) return retomar(o);
    if (o.estado !== 'COSTURA') { toast.error('Sólo se puede sacar de la tablet una orden que está en el taller'); return; }
    setEspera(o);
  };

  if (error) return <div className="p-6"><ErrorState message={error} action={<button type="button" onClick={cargar} className="text-sm font-semibold underline">Reintentar</button>} /></div>;
  if (!data) return <LoadingState />;

  const texto = q.trim().toLowerCase();
  const filtrados = data.articulos.filter((a) => !texto
    || `${a.nombre} ${a.ordenes.map((o) => `${o.sku ?? ''} ${o.color}`).join(' ')}`.toLowerCase().includes(texto));

  const enCurso = ordenes.filter((o) => o.etapa !== 'corte');
  const cortadas = enCurso.reduce((s, o) => s + o.cortado, 0);
  const ingresadas = enCurso.reduce((s, o) => s + o.ingresado, 0);
  const minutos = ordenes.reduce((s, o) => s + o.tiempo.minutos, 0);
  const sinMinutos = ordenes.filter((o) => o.etapa === 'taller' && o.tiempo.registros === 0).length;
  const lotes = ordenes.flatMap(lotesVista);
  const sinTela = ordenes.filter((o) => o.etapa !== 'corte' && o.costos && !o.costos.telaCargada).length;
  const porValidar = ordenes.filter((o) => o.corte.estado === 'cargado').length;
  const saldo = (data.cortadores ?? []).filter((c) => c.saldo !== 0);

  return (
    <div className={`grid min-h-full ${seleccionada ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
      <div className="min-w-0 p-5 md:p-7 flex flex-col gap-5">
        <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex-1 min-w-[240px]">
            <p className="text-xs font-semibold text-amber-600">Producción</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-stone-900">Órdenes</h1>
            <p className="text-[13px] text-stone-500 mt-0.5">{ordenes.length} órdenes abiertas en {data.articulos.length} artículos</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 h-[34px] w-60 max-w-full px-2.5 rounded-lg border border-stone-300 bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artículo, color o SKU" aria-label="Buscar artículo, color o SKU"
                className="flex-1 min-w-0 bg-transparent text-[13px] outline-none" />
            </label>
            <Link href="/produccion?vista=anterior" className="h-[34px] px-3 inline-flex items-center rounded-lg text-[13px] font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-700">Vista anterior</Link>
            <button type="button" onClick={() => setNueva(true)} className="h-[34px] px-3 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-semibold bg-amber-400 text-stone-900 hover:bg-amber-500">+ Nueva producción</button>
          </div>
        </header>

        <div className="grid gap-2.5 grid-cols-2 2xl:grid-cols-4">
          <Tile titulo="En el taller" valor={`${num(cortadas)} u`} bajada={`cortadas · ${num(ingresadas)} ingresadas a stock`} />
          <Tile titulo="Tiempo registrado" valor={`${num(minutos / 60, 1)} h`} bajada={<>en la tablet{sinMinutos > 0 && <b className="text-orange-800 font-semibold"> · {sinMinutos} {sinMinutos === 1 ? 'color' : 'colores'} sin minutos</b>}</>} />
          <Tile titulo="En la tablet" valor={`${lotes.filter((l) => l.enTablet).length} de ${lotes.length} lotes`} bajada="lo que las costureras ven hoy" />
          {data.conValores
            ? <Tile titulo={saldo.length === 1 ? `Saldo con ${saldo[0].nombre}` : 'Saldo con cortadores'} valor={pesos(saldo.reduce((s, c) => s + c.saldo, 0))}
                bajada={`cuenta corriente${porValidar ? ` · ${porValidar} corte${porValidar === 1 ? '' : 's'} por validar` : ''}`} />
            : <Tile titulo="Cortes" valor={`${porValidar} por validar`} bajada="cargados por el cortador" />}
        </div>

        {sinTela > 0 && (
          <div className="flex gap-2.5 items-start rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-[13px] text-orange-800">
            <svg viewBox="0 0 24 24" className="w-[17px] h-[17px] mt-px shrink-0" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            <span><b>{sinTela === ordenes.length ? `Las ${sinTela} órdenes abiertas` : `${sinTela} órdenes`} no tienen costo de tela</b> (sin ficha de tela). El costo que se ve es corte y mano de obra: el real es más alto.</span>
          </div>
        )}

        {ETAPAS.map(({ etapa, titulo, bajada, vacio }) => {
          const arts = filtrados.filter((a) => a.etapa === etapa);
          if (arts.length === 0 && !vacio) return null;
          return (
            <section key={etapa} className="grid gap-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <h2 className="text-[15px] font-bold text-stone-900">{titulo}</h2>
                <span className="text-[12.5px] text-stone-500">{bajada}</span>
              </div>
              {arts.length === 0
                ? <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-[13px] text-stone-500">{texto ? 'Nada coincide con la búsqueda.' : vacio}</p>
                : arts.map((a) => <Articulo key={a.id} a={a} conValores={data.conValores} sel={sel} onSel={setSel} onLote={alternar} onCambio={cargar} />)}
            </section>
          );
        })}

        <details className="rounded-xl border border-stone-200 bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-baseline gap-x-2.5">
            <b className="text-sm">Cerradas · {data.cerradas.total}</b><span className="text-[12.5px] text-stone-500">las últimas {data.cerradas.ultimas.length}</span>
          </summary>
          <ul className="px-4 pb-3 divide-y divide-stone-100">
            {data.cerradas.ultimas.map((c) => (
              <li key={c.id} className="py-2 flex flex-wrap items-baseline gap-x-3 text-[13px]">
                <Link href={`/produccion/${c.id}?volverA=${encodeURIComponent(VOLVER)}`} className="font-mono text-xs text-stone-700 hover:text-amber-600">{c.sku ?? 'Sin SKU'}</Link>
                <span className="flex-1 min-w-0 truncate text-stone-600">{c.descripcion}</span>
                <span className="text-stone-500 tabular-nums">{c.cortado} u</span>
                {c.costoTotal !== undefined && <span className="text-stone-500 tabular-nums">{pesos(c.costoTotal)}</span>}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {seleccionada && (
        <PanelOrden o={seleccionada} articulo={data.articulos.find((a) => a.ordenes.includes(seleccionada))!} costoMinuto={data.costoMinuto}
          volverA={VOLVER} onCerrar={() => setSel(null)} onLote={alternar} onRecargar={cargar} />
      )}

      {nueva && <NuevaProduccion onCerrar={() => setNueva(false)} onCreada={() => { setNueva(false); cargar(); }} />}
      {espera && <ModalEspera o={espera} onCerrar={() => setEspera(null)} onListo={() => { setEspera(null); cargar(); }} />}
    </div>
  );
}

function Tile({ titulo, valor, bajada }: { titulo: string; valor: string; bajada: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3.5 py-3 grid gap-0.5">
      <span className="text-xs font-semibold text-stone-500">{titulo}</span>
      <strong className="text-2xl font-extrabold tracking-tight tabular-nums text-stone-900">{valor}</strong>
      <small className="text-xs text-stone-500">{bajada}</small>
    </div>
  );
}

function Articulo({ a, conValores, sel, onSel, onLote, onCambio }: {
  a: TableroArticulo; conValores: boolean; sel: string | null; onSel: (id: string) => void; onLote: (o: TableroOrden, l: LoteVista) => void; onCambio: () => void;
}) {
  const [ingresarTodos, setIngresarTodos] = useState(false);
  const accionesLote = useAccionesLote(a, onCambio);
  const enTaller = a.ordenes.filter((o) => o.estado === 'COSTURA' && o.loteId);
  const cort = a.ordenes.reduce((s, o) => s + o.cortado, 0);
  const ing = a.ordenes.reduce((s, o) => s + o.ingresado, 0);
  const min = a.ordenes.reduce((s, o) => s + o.tiempo.minutos, 0);
  const costo = a.ordenes.reduce((s, o) => s + (o.costos?.total ?? 0), 0);
  // Las columnas siguen el ancho de la TARJETA (container query), no el de la ventana:
  // con el panel abierto la tarjeta se angosta y pasa a dos columnas en vez de cortarse.
  const cols = conValores
    ? '@3xl:grid-cols-[minmax(160px,1.3fr)_minmax(110px,1fr)_96px_84px_minmax(200px,1.6fr)]'
    : '@3xl:grid-cols-[minmax(160px,1.3fr)_minmax(110px,1fr)_96px_minmax(200px,1.6fr)]';
  return (
    <article className="@container rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-stone-200">
        <div className="flex-1 min-w-[240px]">
          <h3 className="text-[15.5px] font-bold text-stone-900 flex flex-wrap items-center gap-2">
            {a.nombre}
            <span className={`${CHIP} ${CHIP_TONO['']}`}>{a.ordenes.length} {a.ordenes.length === 1 ? 'color' : 'colores'} · {cort} u</span>
          </h3>
          <p className="text-[12.5px] text-stone-500">{a.marca}</p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Met titulo="Ingresadas" valor={`${ing} / ${cort}`} bajada={cort ? `${Math.round(ing / cort * 100)}%` : ''} />
          <Met titulo="Llevamos" valor={horasMin(min)} bajada={cort ? `${num(min / cort, 1)} min por u cortada` : ''} />
          {conValores && <Met titulo="Costo/u hoy" valor={cort ? pesos(costo / cort) : '—'} bajada={a.ordenes.some((o) => !o.costos?.telaCargada) ? 'sin tela' : 'con tela'} />}
        </div>
        {enTaller.length > 1 && (
          <button type="button" onClick={() => setIngresarTodos(true)} className="h-8 px-3 rounded-lg border border-stone-300 bg-white text-[12.5px] font-semibold text-stone-700 hover:bg-stone-50">Ingresar varios colores</button>
        )}
        {accionesLote.items.length > 0 && <MenuAcciones items={accionesLote.items} grande />}
      </header>
      {accionesLote.ventana}
      {ingresarTodos && <ModalIngresar loteId={enTaller[0].loteId!} onCerrar={() => setIngresarTodos(false)} onListo={() => { setIngresarTodos(false); onCambio(); }} />}
      <div className={`hidden @3xl:grid ${cols} gap-x-3.5 px-4 pt-2 pb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-stone-400`}>
        <span>Color</span><span>Avance</span><span>Tiempo</span>{conValores && <span>$/u hoy</span>}<span>Lotes · tablet y etiqueta</span>
      </div>
      {a.ordenes.map((o) => (
        <Fila key={o.id} o={o} cols={cols} conValores={conValores} activa={sel === o.id} onSel={onSel} onLote={onLote} onCambio={onCambio} />
      ))}
    </article>
  );
}

function Met({ titulo, valor, bajada }: { titulo: string; valor: string; bajada: string }) {
  return (
    <div className="grid min-w-[72px]">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{titulo}</span>
      <b className="text-base font-bold tabular-nums text-stone-900">{valor}</b>
      <small className="text-[11px] text-stone-500">{bajada}</small>
    </div>
  );
}

function Fila({ o, cols, conValores, activa, onSel, onLote, onCambio }: {
  o: TableroOrden; cols: string; conValores: boolean; activa: boolean; onSel: (id: string) => void; onLote: (o: TableroOrden, l: LoteVista) => void; onCambio: () => void;
}) {
  const acciones = useAccionesOrden(o, onCambio);
  const [ingresar, setIngresar] = useState(false);
  const avisos = avisosDe(o);
  const pct = o.cortado ? Math.min(100, o.ingresado / o.cortado * 100) : 0;
  return (
    <div className={`grid grid-cols-2 ${cols} gap-x-3.5 gap-y-2.5 items-center px-4 py-3 border-t border-stone-100 ${activa ? 'bg-amber-50' : 'hover:bg-stone-50'}`}>
      <button type="button" onClick={() => onSel(o.id)} className="col-span-2 @3xl:col-span-1 min-w-0 text-left group flex gap-2.5 items-start">
        <Geo o={o} />
        <span className="min-w-0">
          <b className="block text-[13.5px] font-semibold text-stone-900 group-hover:text-amber-600">{o.color}</b>
          <span className="block font-mono text-xs text-stone-500">{o.sku ?? 'Sin SKU'}</span>
          {avisos.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">{avisos.map((x) => <span key={x.texto} className={`${CHIP} ${CHIP_TONO[x.tono]}`}>{x.texto}</span>)}</span>
          )}
        </span>
      </button>
      <div className="grid gap-1">
        <div className="relative h-2 rounded-full bg-amber-100 border border-stone-200 overflow-hidden">
          <i className="absolute inset-y-0 left-0 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
        </div>
        <small className="text-[11.5px] text-stone-500"><b className="text-stone-900 font-semibold">{o.ingresado}</b> de {o.cortado} ingresadas{o.plan !== o.cortado ? ` · plan ${o.plan}` : ''}</small>
      </div>
      <div className="grid text-[13px]">
        <b className="font-semibold tabular-nums">{o.tiempo.minutos ? horasMin(o.tiempo.minutos) : '0 min'}</b>
        <small className="text-[11.5px] text-stone-500">{o.tiempo.minutos && o.cortado ? `${num(o.tiempo.minutos / o.cortado, 1)} min/u cortada` : 'nada registrado'}</small>
      </div>
      {conValores && (
        <div className="grid text-[13px]">
          <b className="font-semibold tabular-nums">{o.costos && o.cortado ? pesos(o.costos.total / o.cortado) : '—'}</b>
          <small className="text-[11.5px] text-stone-500">corte {o.costos && o.cortado ? pesos(o.costos.corte / o.cortado) : '—'}</small>
        </div>
      )}
      <div className="col-span-2 @3xl:col-span-1 flex flex-wrap items-center gap-1.5">
        {lotesVista(o).map((l) => <LoteBoton key={l.numero} o={o} l={l} onLote={onLote} />)}
        <span className="ml-auto flex gap-1.5">
        {o.loteId && o.estado === 'COSTURA' && (
          <button type="button" onClick={() => setIngresar(true)} className="h-7 px-2.5 inline-flex items-center rounded-lg border border-stone-300 bg-white text-[12.5px] font-semibold text-stone-700 hover:bg-stone-50">Ingresar</button>
        )}
        <MenuAcciones items={acciones.items} />
        </span>
      </div>
      {acciones.ventana}
      {ingresar && <ModalIngresar o={o} onCerrar={() => setIngresar(false)} onListo={() => { setIngresar(false); onCambio(); }} />}
    </div>
  );
}

function ModalEspera({ o, onCerrar, onListo }: { o: TableroOrden; onCerrar: () => void; onListo: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    if (!motivo.trim()) return;
    setGuardando(true);
    const r = await fetch(`/api/produccion/cola/${o.id}/espera`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: motivo.trim() }),
    });
    setGuardando(false);
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo sacar de la tablet'); return; }
    toast.success(`${o.color}: fuera de la tablet`);
    onListo();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-900/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Sacar de la tablet" className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200"><h3 className="text-base font-bold">Sacar de la tablet · {o.color}</h3></div>
        <div className="px-5 py-4 grid gap-2">
          <label htmlFor="motivo-espera" className="text-[12.5px] font-semibold text-stone-700">¿Por qué?</label>
          <input id="motivo-espera" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
            placeholder="Por ejemplo: falta dije" className="h-9 rounded-lg border border-stone-300 px-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200" />
          <p className="text-[12.5px] text-stone-500">Pasa a Frenadas con el motivo. Lo que ya esté cosido se puede ingresar igual.</p>
        </div>
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="h-9 px-3 rounded-lg text-[13px] font-semibold text-stone-600 hover:bg-stone-100">Cancelar</button>
          <button type="button" onClick={guardar} disabled={!motivo.trim() || guardando} className="h-9 px-3 rounded-lg text-[13px] font-semibold bg-amber-400 text-stone-900 hover:bg-amber-500 disabled:opacity-50">{guardando ? 'Guardando…' : 'Sacar de la tablet'}</button>
        </div>
      </div>
    </div>
  );
}
