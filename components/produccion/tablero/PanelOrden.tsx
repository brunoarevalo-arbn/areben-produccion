'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { TableroArticulo, TableroOrden } from '@/lib/produccion/tablero';
import { LoteBoton, Ojo } from './Lote';
import { CHIP, CHIP_TONO, avisosDe, fechaCorta, horasMin, lotesVista, num, ordenarTalles, pesos, type LoteVista } from './formato';

const ESTADO_HISTORIAL: Record<string, string> = {
  PENDIENTE: 'Creada', CORTE: 'En corte', COSTURA: 'En el taller', TERMINADO_SIN_ESTAMPA: 'Lista',
  ESTAMPA: 'En estampa', CONTROL_CALIDAD: 'Control de calidad', CERRADA: 'Cerrada',
};
const CORTE_ESTADO: Record<string, string> = { asignado: 'Asignado, falta que lo cargue', cargado: 'Cargado, falta validar', validado: 'Validado' };

export function PanelOrden({ o, articulo, costoMinuto, volverA, onCerrar, onLote }: {
  o: TableroOrden; articulo: TableroArticulo; costoMinuto?: number; volverA: string;
  onCerrar: () => void; onLote: (o: TableroOrden, l: LoteVista) => void;
}) {
  const conValores = !!o.costos;
  const pestanas = ['Resumen', 'Lotes', ...(conValores ? ['Costos'] : []), 'Tiempo', 'Corte', 'Historial'];
  const [tab, setTab] = useState('Resumen');
  const actual = pestanas.includes(tab) ? tab : 'Resumen';
  const lotes = lotesVista(o);
  const volver = encodeURIComponent(volverA);

  return (
    <aside aria-label={`Orden ${o.sku ?? ''}`}
      className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] xl:sticky xl:top-0 xl:h-screen xl:z-auto border-l border-stone-200 bg-white flex flex-col shadow-2xl xl:shadow-none">
      <div className="px-4 pt-3.5 grid gap-2">
        <div className="flex gap-2.5 items-start">
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold leading-tight text-stone-900">{articulo.nombre}</h2>
            <p className="text-[13px] font-semibold text-stone-700">{o.color}</p>
            <p className="font-mono text-xs text-stone-500">{o.sku ?? 'Sin SKU'}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div role="tablist" className="flex gap-0.5 border-b border-stone-200 overflow-x-auto">
          {pestanas.map((t) => (
            <button key={t} role="tab" type="button" aria-selected={t === actual} onClick={() => setTab(t)}
              className={`h-9 px-2.5 -mb-px text-[13px] font-semibold whitespace-nowrap border-b-2 ${t === actual ? 'text-stone-900 border-amber-400' : 'text-stone-500 border-transparent hover:text-stone-700'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 grid gap-3.5 content-start">
        {actual === 'Resumen' && <Resumen o={o} />}
        {actual === 'Lotes' && (
          <>
            {o.lotes.length > 0 ? o.lotes.map((l) => {
              const vista = lotes.find((x) => x.numero === l.numero)!;
              const fallas = l.fallas.reduce((s, f) => s + f.cantidad, 0);
              return (
                <div key={l.id} className={`rounded-xl border p-3 grid gap-1.5 ${vista.enTablet ? 'border-stone-200' : 'border-dashed border-stone-300 bg-stone-50'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-sm">Lote {l.numero}</b>
                    <span className={`${CHIP} ${CHIP_TONO['']}`}>{l.unidades} u</span>
                    <span className={`${CHIP} ${vista.enTablet ? CHIP_TONO.ok : CHIP_TONO['']}`}>{vista.enTablet ? 'en la tablet' : 'oculto'}</span>
                    <button type="button" onClick={() => onLote(o, vista)} aria-label={vista.enTablet ? 'Ocultar de la tablet' : 'Mostrar en la tablet'}
                      className="ml-auto w-7 h-7 grid place-items-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100"><Ojo abierto={vista.enTablet} /></button>
                  </div>
                  <p className="text-[12.5px] text-stone-500">{ordenarTalles(l.talles).map((t) => `${t.talle} ${t.cantidad}`).join(' · ')} · {l.despuesDe === 'Corte' ? 'desde el corte' : `se separa después de ${l.despuesDe}`}</p>
                  {fallas > 0 && (
                    <p className="text-[12.5px] text-orange-800">
                      {l.fallas.map((f) => `${f.cantidad} ${f.parte ? f.parte.toLowerCase() : 'u'} ${f.talle} en ${f.proceso.toLowerCase()}`).join(' · ')} · espera {Object.entries(l.esperadoPorParte).map(([p, n]) => `${n}${p ? ` ${p.toLowerCase()}s` : ''}`).join(' y ')}
                    </p>
                  )}
                  <p className="text-[12.5px] text-stone-500">Ingresado {l.ingresado} de {l.unidades}</p>
                </div>
              );
            }) : (
              <div className="rounded-xl border border-stone-200 p-3 text-[13px] text-stone-600 grid gap-2">
                <span>Sin separar: un solo lote con todo lo cortado ({o.cortado} u).</span>
                <span className="flex gap-1.5">{lotes.map((l) => <LoteBoton key={l.numero} o={o} l={l} onLote={onLote} />)}</span>
              </div>
            )}
            <Link href={`/produccion/${o.id}?volverA=${volver}`} className="justify-self-start text-[13px] font-semibold text-amber-600 hover:text-amber-700">Separar o registrar una falla en la ficha de la orden →</Link>
          </>
        )}
        {actual === 'Costos' && o.costos && <Costos o={o} costoMinuto={costoMinuto ?? 0} />}
        {actual === 'Tiempo' && <Tiempo o={o} />}
        {actual === 'Corte' && (
          <>
            <Bloque titulo="Corte" kv>
              <Kv k="Cortador" v={o.corte.cortador ?? 'Sin asignar'} />
              <Kv k="Fecha" v={fechaCorta(o.corte.fecha)} />
              <Kv k="Estado" v={o.corte.estado ? CORTE_ESTADO[o.corte.estado] ?? o.corte.estado : 'Sin cortador'} />
              {o.corte.monto !== undefined && <Kv k="Monto" v={`${pesos(o.corte.monto)}${o.cortado ? ` · ${pesos(o.corte.monto / o.cortado)}/u` : ''}`} />}
              <Kv k="Ficha de tela" v={o.corte.fichaTela ? 'Cargada' : 'No cargada'} alerta={!o.corte.fichaTela} />
            </Bloque>
            <Bloque titulo="Talles cortados"><Talles o={o} soloCorte /></Bloque>
            <div className="flex flex-wrap gap-2">
              <Link href={`/produccion/${o.id}/corte?volverA=${volver}`} className="h-7 px-2.5 inline-flex items-center rounded-lg border border-stone-300 text-[12.5px] font-semibold text-stone-700 hover:bg-stone-50">{o.corte.fichaTela ? 'Ver ficha de corte' : 'Cargar ficha de tela'}</Link>
            </div>
          </>
        )}
        {actual === 'Historial' && (
          <ol className="grid">
            {o.transiciones.map((t, i) => (
              <li key={i} className="grid grid-cols-[78px_1fr] gap-2 py-1.5 border-b border-stone-100 text-[12.5px]">
                <span className="text-stone-500 tabular-nums">{fechaCorta(t.fecha)}</span>
                <span>{ESTADO_HISTORIAL[t.estado] ?? t.estado}{t.notas ? ` · ${t.notas}` : ''}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex gap-2 px-4 py-3 border-t border-stone-200 bg-stone-50">
        {o.loteId && o.etapa !== 'corte'
          ? <Link href={`/produccion/lote/${o.loteId}/terminar`} className="flex-1 h-9 inline-flex items-center justify-center rounded-lg bg-amber-400 text-[13px] font-semibold text-stone-900 hover:bg-amber-500">Ingresar a stock</Link>
          : <span className="flex-1" />}
        <Link href={`/produccion/${o.id}/lote/${lotes[0].numero}/etiqueta?volverA=${volver}`} className="h-9 px-3 inline-flex items-center rounded-lg border border-stone-300 bg-white text-[13px] font-semibold text-stone-700 hover:bg-stone-50">Etiqueta</Link>
        <Link href={`/produccion/${o.id}?volverA=${volver}`} className="h-9 px-3 inline-flex items-center rounded-lg border border-stone-300 bg-white text-[13px] font-semibold text-stone-700 hover:bg-stone-50">Ficha</Link>
      </div>
    </aside>
  );
}

function Resumen({ o }: { o: TableroOrden }) {
  const avisos = avisosDe(o);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Grande t="Cortadas" v={String(o.cortado)} />
        <Grande t="Ingresadas" v={String(o.ingresado)} />
        <Grande t="Llevamos" v={horasMin(o.tiempo.minutos)} />
      </div>
      {avisos.length > 0 && <div className="flex flex-wrap gap-1">{avisos.map((x) => <span key={x.texto} className={`${CHIP} ${CHIP_TONO[x.tono]}`}>{x.texto}</span>)}</div>}
      <Bloque titulo="Por talle"><Talles o={o} /></Bloque>
      <Bloque titulo="En pocas palabras" kv>
        <Kv k="Cortó" v={`${o.corte.cortador ?? 'Sin cortador'} · ${fechaCorta(o.corte.fecha)}`} />
        <Kv k="Registros en la tablet" v={`${o.tiempo.registros}${o.tiempo.ultimo ? ` · último ${fechaCorta(o.tiempo.ultimo)}` : ''}`} />
        {o.costos && <Kv k="Costo a la fecha" v={pesos(o.costos.total)} />}
        {o.costos && !o.costos.telaCargada && <Kv k="Tela" v="sin ficha de tela" alerta />}
      </Bloque>
    </>
  );
}

function Costos({ o, costoMinuto }: { o: TableroOrden; costoMinuto: number }) {
  const c = o.costos!;
  return (
    <>
      {!c.telaCargada && (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[13px] text-orange-800">Sin ficha de tela: <b>falta la tela</b>{c.sublimacion === 0 ? ' (y el sublimado, si lleva)' : ''}. Este costo es menor que el real.</p>
      )}
      <Bloque titulo="Hasta hoy" kv>
        <Kv k="Tela" v={c.telaCargada ? pesos(c.tela) : 'falta'} alerta={!c.telaCargada} />
        {c.sublimacion > 0 && <Kv k="Sublimado" v={pesos(c.sublimacion)} />}
        <Kv k={`Corte${o.corte.cortador ? ` (${o.corte.cortador})` : ''}`} v={pesos(c.corte)} />
        <Kv k={`Mano de obra · ${num(o.tiempo.minutos)} min × ${pesos(costoMinuto)}`} v={pesos(c.manoDeObra)} />
        <div className="col-span-2 border-t border-dashed border-stone-300" />
        <Kv k="Total a la fecha" v={pesos(c.total)} fuerte />
        {o.cortado > 0 && <Kv k={`Por unidad cortada (${o.cortado})`} v={pesos(c.total / o.cortado)} />}
      </Bloque>
    </>
  );
}

function Tiempo({ o }: { o: TableroOrden }) {
  const barras = (obj: Record<string, number>, etiqueta = (k: string) => k) => {
    const filas = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...filas.map((f) => f[1]));
    return filas.length === 0
      ? <p className="text-[13px] text-stone-500">Sin registros.</p>
      : filas.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[96px_1fr_64px] gap-2 items-center text-[12.5px]">
          <span className="text-stone-700 truncate">{etiqueta(k)}</span>
          <i className="block h-2 rounded-full bg-amber-400 min-w-[2px]" style={{ width: `${v / max * 100}%` }} />
          <b className="text-right font-semibold tabular-nums">{num(v)} min</b>
        </div>
      ));
  };
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Grande t="Llevamos" v={horasMin(o.tiempo.minutos)} />
        <Grande t="min/u cortada" v={o.cortado ? num(o.tiempo.minutos / o.cortado, 1) : '—'} />
        <Grande t="Registros" v={String(o.tiempo.registros)} />
      </div>
      {o.tiempo.registros === 0 && o.etapa === 'taller' && (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[13px] text-orange-800">No hay minutos registrados en este SKU. Si ya se trabajó, probablemente quedó cargado en otro color.</p>
      )}
      <Bloque titulo="Por máquina">{barras(o.tiempo.porMaquina)}</Bloque>
      {o.partes.length > 0 && <Bloque titulo="Por pieza">{barras(o.tiempo.porParte)}</Bloque>}
      {o.lotes.length > 0 && <Bloque titulo="Por lote">{barras(o.tiempo.porLote, (k) => k === 'sin lote' ? 'Sin lote' : `Lote ${k}`)}</Bloque>}
    </>
  );
}

function Talles({ o, soloCorte }: { o: TableroOrden; soloCorte?: boolean }) {
  if (!o.talles) return <p className="text-[13px] text-stone-500">No hay talles cargados del corte.</p>;
  const talles = ordenarTalles(o.talles);
  const varios = !soloCorte && o.lotes.length > 1;
  return (
    <table className="w-full text-[13px] tabular-nums">
      <thead>
        <tr className="text-[11px] text-stone-500 border-b border-stone-200">
          <th className="text-left font-semibold pb-1">Talle</th><th className="text-right font-semibold pb-1">Cortadas</th>
          {varios && o.lotes.map((l) => <th key={l.id} className="text-right font-semibold pb-1">L{l.numero}</th>)}
        </tr>
      </thead>
      <tbody>
        {talles.map((t) => (
          <tr key={t.talle} className="border-b border-stone-100">
            <td className="py-1.5">{t.talle}</td><td className="text-right">{t.cantidad}</td>
            {varios && o.lotes.map((l) => <td key={l.id} className="text-right">{l.talles.find((x) => x.talle === t.talle)?.cantidad ?? 0}</td>)}
          </tr>
        ))}
        <tr className="font-bold">
          <td className="py-1.5">Total</td><td className="text-right">{talles.reduce((s, t) => s + t.cantidad, 0)}</td>
          {varios && o.lotes.map((l) => <td key={l.id} className="text-right">{l.unidades}</td>)}
        </tr>
      </tbody>
    </table>
  );
}

function Bloque({ titulo, children, kv }: { titulo: string; children: React.ReactNode; kv?: boolean }) {
  return (
    <section className="grid gap-2">
      <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-stone-500">{titulo}</h4>
      <div className={kv ? 'grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[13px]' : 'grid gap-1.5'}>{children}</div>
    </section>
  );
}

function Kv({ k, v, alerta, fuerte }: { k: string; v: string; alerta?: boolean; fuerte?: boolean }) {
  return (
    <>
      <span className={`text-stone-700 ${fuerte ? 'font-semibold' : ''}`}>{k}</span>
      <b className={`text-right tabular-nums ${alerta ? 'text-orange-800' : ''} ${fuerte ? 'font-bold' : 'font-semibold'}`}>{v}</b>
    </>
  );
}

function Grande({ t, v }: { t: string; v: string }) {
  return (
    <div className="rounded-xl border border-stone-200 px-2.5 py-2 grid">
      <span className="text-[11px] font-semibold text-stone-500">{t}</span>
      <b className="text-xl font-extrabold tracking-tight tabular-nums">{v}</b>
    </div>
  );
}
