'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TableroArticulo, TableroOrden } from '@/lib/produccion/tablero';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { FallaForm } from '@/components/produccion/FallaForm';
import { TerminarLoteForm } from '@/components/produccion/TerminarLoteForm';
import { LoadingState } from '@/components/ui/LoadingState';

// Las acciones de un color en el tablero. Usan los MISMOS endpoints que la cola de siempre:
// el tablero no decide nada nuevo, sólo las pone a mano.

type Modal = null | 'ingresar' | 'falla' | 'cortador' | 'editar' | 'espera' | { estado: string; titulo: string };

async function pedir(url: string, init: RequestInit, ok: string, onCambio: () => void) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo hacer el cambio'); return false; }
  toast.success(ok);
  onCambio();
  return true;
}

export function useAccionesOrden(o: TableroOrden, onCambio: () => void) {
  const [modal, setModal] = useState<Modal>(null);
  const cerrar = () => setModal(null);
  const listo = () => { setModal(null); onCambio(); };

  const cambiarEstado = async (estado: string, mensaje: string, notas?: string) =>
    pedir(`/api/produccion/cola/${o.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado, notas }) }, mensaje, onCambio);

  const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
  const enCorte = o.estado === 'PENDIENTE' || o.estado === 'CORTE';
  const listaParaCerrar = ['TERMINADO_SIN_ESTAMPA', 'ESTAMPA', 'CONTROL_CALIDAD'].includes(o.estado);

  if (o.estado === 'COSTURA' && o.loteId) items.push({ label: 'Ingresar a stock…', onClick: () => setModal('ingresar') });
  if (o.estado === 'COSTURA') items.push({ label: 'Registrar falla…', onClick: () => setModal('falla') });
  if (o.estado === 'COSTURA' && o.lotes.length === 0) {
    items.push(o.enEspera
      ? { label: 'Volver a la tablet', onClick: () => pedir(`/api/produccion/cola/${o.id}/espera`, { method: 'DELETE' }, `${o.color}: vuelve a la tablet`, onCambio) }
      : { label: 'Sacar de la tablet…', onClick: () => setModal('espera') });
  }
  if (o.corte.estado === 'cargado' && !o.corte.fichaTela) {
    items.push({ label: 'Validar corte', onClick: async () => {
      if (await confirmAsync({ message: `Validar el corte de ${o.color}${o.corte.cortador ? ` (${o.corte.cortador})` : ''}: queda cobrable en la cuenta del cortador.`, confirmLabel: 'Validar' })) {
        pedir(`/api/produccion/cola/${o.id}/validar-corte`, { method: 'POST' }, 'Corte validado', onCambio);
      }
    } });
  }
  if (!o.corte.fichaTela && o.corte.estado !== 'validado') items.push({ label: o.corte.cortadorId ? 'Cambiar cortador…' : 'Asignar cortador…', onClick: () => setModal('cortador') });
  if (enCorte) {
    items.push({ label: 'Mandar al taller', onClick: async () => {
      if (await confirmAsync({ message: `${o.color} pasa al taller y la tablet lo empieza a mostrar.`, confirmLabel: 'Mandar al taller' })) cambiarEstado('COSTURA', `${o.color}: en el taller`);
    } });
  }
  if (listaParaCerrar) {
    items.push({ label: 'Cerrar orden', onClick: async () => {
      if (await confirmAsync({ message: `Cerrar ${o.color}: pasa a Cerradas.`, confirmLabel: 'Cerrar' })) cambiarEstado('CERRADA', `${o.color}: cerrada`);
    } });
    items.push({ label: 'Volver al taller…', onClick: () => setModal({ estado: 'COSTURA', titulo: 'Volver al taller' }) });
  }
  if (o.estado === 'COSTURA') items.push({ label: 'Volver a corte…', onClick: () => setModal({ estado: 'CORTE', titulo: 'Volver a corte' }) });
  if (o.estado === 'CORTE') items.push({ label: 'Volver a pendiente…', onClick: () => setModal({ estado: 'PENDIENTE', titulo: 'Volver a pendiente' }) });
  items.push({ label: 'Editar…', onClick: () => setModal('editar') });
  items.push({ label: 'Eliminar orden', danger: true, onClick: async () => {
    if (await confirmAsync({ message: `Eliminar la orden ${o.sku ?? ''} (${o.color}). Se deshace lo que haya ingresado a stock.`, danger: true, confirmLabel: 'Eliminar' })) {
      pedir(`/api/produccion/cola/${o.id}`, { method: 'DELETE' }, 'Orden eliminada', onCambio);
    }
  } });

  const ventana = modal && (
    modal === 'ingresar' ? <ModalIngresar o={o} onCerrar={cerrar} onListo={listo} />
    : modal === 'falla' ? (
      <Ventana titulo={`Registrar falla · ${o.color}`} onCerrar={cerrar}>
        <FallaForm ordenId={o.id} onGuardado={listo} onCancelar={cerrar} />
      </Ventana>
    )
    : modal === 'cortador' ? <ModalCortador o={o} onCerrar={cerrar} onListo={listo} />
    : modal === 'editar' ? <ModalEditar o={o} onCerrar={cerrar} onListo={listo} />
    : modal === 'espera' ? <ModalTexto titulo={`Sacar de la tablet · ${o.color}`} etiqueta="¿Por qué?" ejemplo="Por ejemplo: falta dije" boton="Sacar de la tablet"
        ayuda="Pasa a Frenadas con el motivo. Lo que ya esté cosido se puede ingresar igual." onCerrar={cerrar}
        onGuardar={async (motivo) => { if (await pedir(`/api/produccion/cola/${o.id}/espera`, { method: 'POST', body: JSON.stringify({ motivo }) }, `${o.color}: fuera de la tablet`, onCambio)) cerrar(); }} />
    : <ModalTexto titulo={`${modal.titulo} · ${o.color}`} etiqueta="Motivo" ejemplo="Por qué vuelve atrás" boton={modal.titulo}
        ayuda="Volver atrás pide un motivo: queda en el historial de la orden." onCerrar={cerrar}
        onGuardar={async (notas) => { if (await cambiarEstado(modal.estado, `${o.color}: ${modal.titulo.toLowerCase()}`, notas)) cerrar(); }} />
  );

  return { items, ventana };
}

/**
 * Las acciones del LOTE entero (un artículo con varios colores). Mismos endpoints que la
 * cola de siempre: cortador a todos, fichas de corte, mandar todo al taller y cerrar los
 * listos. Ingresar varios colores ya está como botón en la cabecera.
 */
export function useAccionesLote(a: TableroArticulo, onCambio: () => void) {
  const router = useRouter();
  const [cortador, setCortador] = useState(false);
  const loteId = a.ordenes[0]?.loteId;
  const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (!loteId || a.ordenes.length < 2) return { items, ventana: null };

  // Sólo los colores sin corte cargado: lo cargado o validado ya es del cortador que lo cortó.
  const asignables = a.ordenes.filter((o) => !o.corte.fichaTela && (o.corte.estado === null || o.corte.estado === 'asignado'));
  const sinFicha = a.ordenes.filter((o) => !o.corte.fichaTela);
  const alTaller = a.ordenes.filter((o) => o.etapa === 'corte' && o.sku);
  const listos = a.ordenes.filter((o) => o.estado === 'TERMINADO_SIN_ESTAMPA');
  const ids = new Set(asignables.map((o) => o.corte.cortadorId ?? ''));

  const estadoLote = async (estado: 'COSTURA' | 'CERRADA', n: number) => {
    const que = estado === 'COSTURA' ? `Mandar ${n} ${n === 1 ? 'color' : 'colores'} al taller: la tablet los empieza a mostrar.` : `Cerrar ${n} ${n === 1 ? 'color listo' : 'colores listos'}: pasan a Cerradas.`;
    if (!(await confirmAsync({ message: que, confirmLabel: estado === 'COSTURA' ? 'Mandar al taller' : 'Cerrar', danger: estado === 'CERRADA' }))) return;
    const r = await fetch(`/api/produccion/lote/${loteId}/estado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo cambiar el lote'); return; }
    const d = await r.json().catch(() => ({}));
    toast.success(`${d.avanzados ?? n} ${d.avanzados === 1 ? 'color' : 'colores'} ${estado === 'COSTURA' ? 'en el taller' : 'cerrados'}`);
    onCambio();
  };

  if (asignables.length > 0) items.push({ label: `Cortador para ${asignables.length === a.ordenes.length ? 'todo el lote' : `${asignables.length} colores`}…`, onClick: () => setCortador(true) });
  if (sinFicha.length > 0) items.push({ label: 'Fichas de corte del lote', onClick: () => router.push(`/produccion/lote/${loteId}/corte`) });
  if (alTaller.length > 0) items.push({ label: `Mandar ${alTaller.length === 1 ? '1 color' : `${alTaller.length} colores`} al taller`, onClick: () => estadoLote('COSTURA', alTaller.length) });
  if (listos.length > 0) items.push({ label: `Cerrar ${listos.length === 1 ? 'el listo' : `los ${listos.length} listos`}`, onClick: () => estadoLote('CERRADA', listos.length) });

  const ventana = cortador && (
    <ElegirCortador titulo={`Cortador · ${a.nombre}`} actual={ids.size === 1 ? [...ids][0] : ''} url={`/api/produccion/lote/${loteId}/asignar-cortador`}
      ayuda={`Se asigna a ${asignables.length} ${asignables.length === 1 ? 'color' : 'colores'} sin corte cargado. Los que ya cargó o validó el cortador no se tocan.`}
      onCerrar={() => setCortador(false)} onListo={() => { setCortador(false); onCambio(); }} />
  );
  return { items, ventana };
}

/**
 * El botón ⋮ con el menú. Se dibuja FIJO sobre la pantalla (no dentro de la tarjeta, que lo
 * recortaría) y abre hacia arriba si abajo no entra.
 */
export function MenuAcciones({ items, grande }: { items: { label: string; onClick: () => void; danger?: boolean }[]; arriba?: boolean; grande?: boolean }) {
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const abrir = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (pos) { setPos(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const alto = items.length * 36 + 8;
    const right = window.innerWidth - r.right;
    setPos(r.bottom + alto + 8 > window.innerHeight ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 });
  };
  return (
    <>
      <button type="button" onClick={abrir} aria-label="Más acciones" aria-expanded={!!pos}
        className={`${grande ? 'w-9 h-9' : 'w-7 h-7'} grid place-items-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-100 hover:text-stone-900`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} aria-hidden />
          <div role="menu" style={pos} className="fixed z-50 w-56 bg-white border border-stone-200 rounded-xl shadow-lg py-1">
            {items.map((it) => (
              <button key={it.label} role="menuitem" type="button" onClick={() => { setPos(null); it.onClick(); }}
                className={`w-full text-left px-3 h-9 text-[13px] hover:bg-stone-50 ${it.danger ? 'text-red-600' : 'text-stone-700'}`}>{it.label}</button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function Ventana({ titulo, onCerrar, ancho = 'max-w-md', children }: { titulo: string; onCerrar: () => void; ancho?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-900/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`w-full ${ancho} max-h-[calc(100vh-2rem)] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden`}>
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-3">
          <h3 className="text-base font-bold">{titulo}</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const CAMPO = 'h-9 w-full rounded-lg border border-stone-300 px-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200';
const BOTON = 'h-9 px-3 rounded-lg text-[13px] font-semibold bg-amber-400 text-stone-900 hover:bg-amber-500 disabled:opacity-50';
const BOTON_2 = 'h-9 px-3 rounded-lg text-[13px] font-semibold text-stone-600 hover:bg-stone-100';

function ModalTexto({ titulo, etiqueta, ejemplo, boton, ayuda, onCerrar, onGuardar }: {
  titulo: string; etiqueta: string; ejemplo: string; boton: string; ayuda: string; onCerrar: () => void; onGuardar: (texto: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => { if (!texto.trim()) return; setGuardando(true); await onGuardar(texto.trim()); setGuardando(false); };
  return (
    <Ventana titulo={titulo} onCerrar={onCerrar}>
      <div className="grid gap-2">
        <label htmlFor="texto-accion" className="text-[12.5px] font-semibold text-stone-700">{etiqueta}</label>
        <input id="texto-accion" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} placeholder={ejemplo} className={CAMPO} />
        <p className="text-[12.5px] text-stone-500">{ayuda}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCerrar} className={BOTON_2}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={!texto.trim() || guardando} className={BOTON}>{guardando ? 'Guardando…' : boton}</button>
        </div>
      </div>
    </Ventana>
  );
}

function ModalEditar({ o, onCerrar, onListo }: { o: TableroOrden; onCerrar: () => void; onListo: () => void }) {
  const [cantidad, setCantidad] = useState(String(o.plan));
  const [descripcion, setDescripcion] = useState(o.descripcionCompleta ?? '');
  const [notas, setNotas] = useState(o.notas ?? '');
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    const ok = await pedir(`/api/produccion/cola/${o.id}`, { method: 'PATCH', body: JSON.stringify({ cantidad: parseInt(cantidad) || 0, descripcion, notas }) }, 'Orden guardada', () => {});
    setGuardando(false);
    if (ok) onListo();
  };
  return (
    <Ventana titulo={`Editar · ${o.sku ?? o.color}`} onCerrar={onCerrar}>
      <div className="grid gap-3">
        <label className="grid gap-1 text-[12.5px] font-semibold text-stone-700">Cantidad planificada
          <input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))} className={CAMPO} />
          <span className="font-normal text-stone-500">Lo cortado se carga con el corte; esto es sólo el plan.</span>
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold text-stone-700">Descripción
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={CAMPO} />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold text-stone-700">Notas
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={`${CAMPO} h-auto py-2`} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={BOTON_2}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className={BOTON}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Ventana>
  );
}

function ModalCortador({ o, onCerrar, onListo }: { o: TableroOrden; onCerrar: () => void; onListo: () => void }) {
  return <ElegirCortador titulo={`Cortador · ${o.color}`} actual={o.corte.cortadorId ?? ''} url={`/api/produccion/cola/${o.id}/asignar-cortador`}
    ayuda="El cortador lo ve en “Mis cortes” y carga ahí lo que cortó." onCerrar={onCerrar} onListo={onListo} />;
}

function ElegirCortador({ titulo, actual, url, ayuda, onCerrar, onListo }: {
  titulo: string; actual: string; url: string; ayuda: string; onCerrar: () => void; onListo: () => void;
}) {
  const [cortadores, setCortadores] = useState<{ id: string; nombre: string; activo: boolean }[] | null>(null);
  const [elegido, setElegido] = useState(actual);
  useEffect(() => {
    fetch('/api/cortadores').then((r) => r.json()).then((d) => setCortadores(Array.isArray(d) ? d.filter((c) => c.activo) : [])).catch(() => setCortadores([]));
  }, []);
  const guardar = async () => {
    if (await pedir(url, { method: 'POST', body: JSON.stringify({ cortadorId: elegido || null }) }, elegido ? 'Cortador asignado' : 'Cortador quitado', () => {})) onListo();
  };
  return (
    <Ventana titulo={titulo} onCerrar={onCerrar}>
      {!cortadores ? <LoadingState /> : (
        <div className="grid gap-3">
          <select value={elegido} onChange={(e) => setElegido(e.target.value)} className={CAMPO} aria-label="Cortador">
            <option value="">Sin cortador</option>
            {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <p className="text-[12.5px] text-stone-500">{ayuda}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className={BOTON_2}>Cancelar</button>
            <button type="button" onClick={guardar} className={BOTON}>Guardar</button>
          </div>
        </div>
      )}
    </Ventana>
  );
}

type DatosTerminar = { id: string; titulo: string; ordenes: Parameters<typeof TerminarLoteForm>[0]['ordenes'] };

/** "Ingresar a stock" sin salir del tablero: el mismo formulario de terminar el lote. `o = null` ⇒ todos los colores del lote. */
export function ModalIngresar({ o, loteId, onCerrar, onListo }: { o?: TableroOrden; loteId?: string; onCerrar: () => void; onListo: () => void }) {
  const lote = o?.loteId ?? loteId!;
  const [datos, setDatos] = useState<DatosTerminar | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/produccion/lote/${lote}/terminar${o ? `?orden=${o.id}` : ''}`)
      .then(async (r) => (r.ok ? setDatos(await r.json()) : setError((await r.json().catch(() => ({}))).error ?? 'No se pudo cargar')))
      .catch(() => setError('No se pudo cargar'));
  }, [lote, o]);
  return (
    <Ventana titulo={o ? `Ingresar a stock · ${o.color}` : `Ingresar a stock · ${datos?.titulo ?? ''}`} onCerrar={onCerrar} ancho="max-w-3xl">
      {error ? <p className="text-sm text-red-700">{error}</p>
        : !datos ? <LoadingState />
        : datos.ordenes.length === 0 ? <p className="text-sm text-stone-600">No hay colores en el taller para ingresar.</p>
        : <TerminarLoteForm loteId={datos.id} ordenes={datos.ordenes} onListo={() => { toast.success('Ingresado a stock'); onListo(); }} onCancelar={onCerrar} />}
    </Ventana>
  );
}
