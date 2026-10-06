'use client';

import { useState, useEffect, useCallback } from 'react';
import { TiemposProduccion } from '@/types/tiempos';
import type { EstadoCronometro } from '@/lib/hooks/useTiempos';
import { INCONVENIENTES } from '@/lib/constants/inconvenientes';
import { MAQUINAS, MAQUINA_NINGUNA } from '@/lib/constants/maquinas';
import { PARTE_COMPARTIDA, MAQUINA_COMPARTIDA } from '@/lib/constants/partes';
import { ACTIVIDAD_PROCESO } from '@/lib/constants/actividades';
import { MAQUINA_DEL_PROCESO } from '@/lib/constants/lotes';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';

interface FormTiemposProps {
  usuario: string;
  ordenesIniciales: OrdenActiva[];
  estado: EstadoCronometro;
  onObtenerTiempos: () => { horaInicio: string; horaFin: string; minutosNetos: number } | undefined;
  onGuardar: (tiempo: TiemposProduccion) => Promise<unknown>;
  onRefresh: () => void;
  /** Cierra el reloj y lo vuelve a arrancar de una: es lo que deja cambiar de parte sin parar. */
  onReiniciarReloj: () => void;
  loading: boolean;
}

interface OrdenActiva {
  id:          string;
  sku:         string | null;
  descripcion: string | null;
  marca:       string;
  cantidad:    number;
  estado:      string;
  /** Las partes que se cosen por separado ("Corpiño", "Bombacha"). Vacío = prenda entera. */
  partes?:     string[];
  /**
   * El lote de ESTA fila: una orden separada aparece una vez por cada lote que el taller
   * dejó visible, y la costurera toca la bolsa que tiene en la mano. `null` = sin lote.
   */
  lote?:       number | null;
  /** Si la orden tiene una separación PROGRAMADA: el proceso que, al terminar, la activa. */
  confirmarDespuesDe?: string | null;
}

const ACTIVIDADES: { label: string; icon: string; color: string }[] = [
  { label: ACTIVIDAD_PROCESO,    icon: '✅', color: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
  { label: 'Muestra Zattia',     icon: '📐', color: 'bg-violet-50 border-violet-400 text-violet-800' },
  { label: 'Muestra Stunned',    icon: '📐', color: 'bg-pink-50 border-pink-400 text-pink-800' },
  { label: 'Descanso',           icon: '☕', color: 'bg-sky-50 border-sky-400 text-sky-800' },
  { label: 'Almuerzo',           icon: '🍽️', color: 'bg-orange-50 border-orange-400 text-orange-800' },
  { label: 'Falla Máquina',      icon: '⚠️', color: 'bg-red-50 border-red-400 text-red-800' },
  { label: 'Cambio Hilo',        icon: '🧵', color: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
];

const LIBRE_ID = '__libre__';

// Una orden separada aparece una vez por lote: la fila se identifica por orden Y lote.
const claveFila = (o: { id: string; lote?: number | null }) => (o.lote != null ? `${o.id}#${o.lote}` : o.id);

export function FormTiempos({ usuario, ordenesIniciales, estado, onObtenerTiempos, onGuardar, onRefresh, onReiniciarReloj, loading }: FormTiemposProps) {
  const [actividad,   setActividad]   = useState('');
  const [ordenId,     setOrdenId]     = useState('');
  const [detalleLibre, setDetalleLibre] = useState('');
  const [parte,       setParte]       = useState('');
  const [cambiando,   setCambiando]   = useState(false);
  const [confirmParte, setConfirmParte] = useState<{ nueva: string; minutos: number } | null>(null);
  // "No, todavía no" a la pregunta del remallado: no se vuelve a preguntar con esa máquina.
  const [noTerminoCon, setNoTerminoCon] = useState('');
  const [activando,    setActivando]    = useState(false);
  const [maquina,     setMaquina]     = useState('');
  const [defectos,    setDefectos]    = useState('0');
  const [ordenes,     setOrdenes]     = useState<OrdenActiva[]>(ordenesIniciales);
  const [finalizando, setFinalizando] = useState(false);
  const [confirmFin,  setConfirmFin]  = useState(false);
  // El botón fijo "Terminé el remallado": se confirma igual que el aviso de terminé.
  const [confirmProceso, setConfirmProceso] = useState(false);
  const [errorFin,    setErrorFin]    = useState<string | null>(null);
  const [inconveniente,      setInconveniente]      = useState<string>('');
  const [inconvenienteNotas, setInconvenienteNotas] = useState<string>('');
  const [showInconv,         setShowInconv]         = useState(false);

  const fetchOrdenes = useCallback(async () => {
    try {
      const r = await fetch('/api/tiempos/cola');
      if (r.ok) {
        const data: OrdenActiva[] = await r.json();
        setOrdenes(data);
      }
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  useEffect(() => {
    const interval = setInterval(fetchOrdenes, 30_000);
    return () => clearInterval(interval);
  }, [fetchOrdenes]);

  // `ordenId` guarda la CLAVE de la fila (orden + lote); las llamadas a la API usan
  // `ordenSeleccionada.id`, que es la orden.
  const ordenSeleccionada = ordenes.find((o) => claveFila(o) === ordenId) ?? null;
  const partesDisponibles = ordenSeleccionada?.partes ?? [];
  // 🔑 La separación programada ("el Lote 2 después del remallado") se pregunta cuando el
  // trabajo DEJA la máquina de ese proceso: Marisol elige otra. "Sin máquina" no cuenta —
  // cortar hilos o dar vuelta puede pasar en medio del remallado—.
  const maquinaDelProceso = ordenSeleccionada?.confirmarDespuesDe
    ? MAQUINA_DEL_PROCESO[ordenSeleccionada.confirmarDespuesDe] ?? null
    : null;
  const preguntarSiTermino = !!maquinaDelProceso && !!maquina && maquina !== maquinaDelProceso &&
    maquina !== MAQUINA_NINGUNA && noTerminoCon !== maquina;
  const relojCorriendo = estado !== 'idle' && !!actividad;
  const loteDelRegistro = ordenSeleccionada?.lote ?? null;
  // El tubo sale de la cortacollareta de una vez y la tira va a las dos piezas ⇒
  // hay una opción más que ⛔ no es una pieza. Se OFRECE siempre (la máquina se
  // elige abajo y podría cambiarse después) y se SUGIERE cuando la máquina es ésa,
  // pero ⛔ nunca se asigna sola: asignarla sola mandaría a "Compartido" un tramo
  // que se venía cosiendo de una pieza, sin que nadie lo confirme.
  const sugerirCompartido = partesDisponibles.length > 0 && maquina === MAQUINA_COMPARTIDA;
  // Hay un cronómetro abierto (corriendo o en pausa) listo para guardarse.
  const hayTarea = estado !== 'idle';
  // 🔴 Con una orden de producción elegida, la MÁQUINA es obligatoria: sin ella el
  // registro dice cuánto se trabajó pero ⛔ no en qué paso, y mientras no haya
  // `ProcesoPrenda` aprobado la máquina ES el paso. Se pide "Sin máquina" cuando de
  // verdad no usó ninguna.
  //
  // ⚠️ Traba el GUARDAR, ⛔ nunca el arranque del reloj: la orden se elige AL FINAL
  // —Marisol arranca a coser y recién después dice qué era—, así que exigirla antes
  // le rompería el orden de trabajo, igual que se lo rompió la pieza preseleccionada
  // el 18-sep. El trabajo libre (sin orden) ⛔ no la necesita.
  const faltaMaquina = !!ordenSeleccionada && !maquina;
  // 🔴 Un Proceso Completado se guarda con una ORDEN o con "trabajo libre", nunca sin
  // nada: el libre se cobra como gasto de taller (`gastoDelTiempo`), y si "no elegí"
  // se guardara igual que "libre", un olvido se volvía gasto. Y el libre dice QUÉ
  // se hizo (planchado, arreglos): es el concepto del gasto. Mismo criterio que la
  // máquina: traba el GUARDAR, ⛔ nunca el reloj.
  const esLibre = ordenId === LIBRE_ID;
  const esProceso = actividad === ACTIVIDAD_PROCESO;
  const faltaOrden = esProceso && !ordenId;
  const faltaDetalle = esProceso && esLibre && !detalleLibre.trim();
  const faltaAlgo = faltaMaquina || faltaOrden || faltaDetalle;

  const marcarCosturaTerminada = async () => {
    if (!ordenSeleccionada) return;
    setFinalizando(true);
    setErrorFin(null);
    try {
      const r = await fetch(`/api/tiempos/cola/${ordenSeleccionada.id}`, { method: 'PATCH' });
      if (r.ok) {
        setOrdenId('');
        setConfirmFin(false);
        await fetchOrdenes();
      } else {
        const data = await r.json().catch(() => ({}));
        setErrorFin(typeof data.error === 'string' ? data.error : 'No se pudo avisar. Probá de nuevo.');
      }
    } catch {
      setErrorFin('Sin conexión. Revisá internet y probá de nuevo.');
    } finally {
      setFinalizando(false);
    }
  };

  // Un solo armador del registro, para que "guardar" y "cambiar de parte" no
  // puedan divergir en qué campos mandan.
  const armarRegistro = (
    t: { horaInicio: string; horaFin: string; minutosNetos: number },
    parteDelRegistro: string,
    // Para cerrar el tramo del proceso que terminó: con SU máquina y sin lote (es de todos).
    cierre?: { maquina: string },
  ): TiemposProduccion => ({
    usuario,
    actividad,
    fecha:        new Date().toISOString().split('T')[0],
    marca:        ordenSeleccionada?.marca   || undefined,
    maquina:      cierre?.maquina ?? (maquina || undefined),
    sku:          ordenSeleccionada?.sku     || undefined,
    parte:        parteDelRegistro          || undefined,
    // El lote lo pone el taller (el que tiene en la mesa), ⛔ la costurera no lo elige.
    lote:         loteDelRegistro ?? undefined,
    detalle:      esProceso && esLibre ? detalleLibre.trim() : undefined,
    // ⛔ `cantidad` ⛔ NO se manda más. La tablet la copiaba de `OrdenProduccion.cantidad`
    // (lo PLANIFICADO) en cada registro y nadie la tocaba: el 18-sep los 7 registros de
    // la bikini decían "60" sobre un corte de 62, y el reporte del día sumaba 462
    // "prendas" habiendo entrado CERO. Contar en la mesa con una sola costurera no es
    // viable (decisión de Bruno, 18-sep) y el denominador del min/prenda ya ⛔ no sale
    // de acá: sale de lo INGRESADO o lo CORTADO de la OP (`lib/produccion/cantidades.ts`).
    defectos:     parseInt(defectos) || 0,
    horaInicio:   t.horaInicio,
    horaFin:      t.horaFin,
    minutosNetos: t.minutosNetos,
    estado: 'guardado',
    inconveniente:      inconveniente || undefined,
    inconvenienteNotas: inconveniente && inconvenienteNotas.trim() ? inconvenienteNotas.trim() : undefined,
  });

  /**
   * Tocar la otra pieza PIDE el cambio; no lo hace. Cerrar un registro es escribir
   * en el día de Marisol, y eso se confirma: el cambio pasa dos o tres veces por
   * tanda —cuando termina los corpiños y arranca las bombachas—, no todo el día,
   * así que el Enter de más no molesta y evita que un roce guarde un tramo partido.
   */
  const pedirCambioParte = (nueva: string) => {
    if (nueva === parte || cambiando) return;
    // Sin reloj corriendo no hay nada que cerrar: es sólo elegir con qué empieza.
    if (estado === 'idle' || !actividad) { setParte(nueva); return; }
    // 🔑 Sin parte todavía tampoco hay nada que cerrar: los minutos que corrieron
    // ⛔ no están puestos en ninguna pieza, así que esto ⛔ no es un CAMBIO — es
    // decir por primera vez qué se estuvo cosiendo. Cerrar un registro acá
    // inventaría una pieza anterior que nunca existió.
    if (!parte) { setParte(nueva); return; }
    setConfirmParte({ nueva, minutos: onObtenerTiempos()?.minutosNetos ?? 0 });
  };

  /**
   * ⚠️ La foto se saca ACÁ, al confirmar, y ⛔ no cuando se abrió el cartel: los
   * segundos que Marisol tardó en leerlo todavía son de la pieza que venía cosiendo.
   * Por eso lo guardado puede ser unos segundos más que lo que decía el cartel.
   */
  const confirmarCambioParte = async () => {
    const pedido = confirmParte;
    if (!pedido || cambiando) return;

    const t = onObtenerTiempos();
    if (!t) { setParte(pedido.nueva); setConfirmParte(null); return; }

    // Cambiar de pieza CIERRA un registro ⇒ pasa por la misma exigencia que guardar.
    if (faltaMaquina) {
      toast.error('Elegí la máquina antes de cambiar de pieza: el registro que se cierra la necesita.');
      setConfirmParte(null);
      return;
    }

    setCambiando(true);
    try {
      await onGuardar(armarRegistro(t, parte));
      onReiniciarReloj();
      setParte(pedido.nueva);
      setConfirmParte(null);
      setInconveniente('');
      setInconvenienteNotas('');
      setShowInconv(false);
    } catch {
      // El registro no se guardó ⇒ NO se cambia de parte ni se toca el reloj:
      // los minutos que corrieron siguen siendo de la pieza que venía.
      toast.error('No se pudo cerrar la parte anterior. El reloj sigue corriendo.');
    } finally {
      setCambiando(false);
    }
  };

  /**
   * "Sí, terminé el remallado": se activan los lotes. Si el reloj está andando, ese tramo
   * es de remallado —de TODAS las unidades— y se cierra antes, con la máquina del proceso
   * y sin lote; si no, se lo llevaría entero el Lote 1.
   */
  const confirmarProcesoTerminado = async () => {
    if (!ordenSeleccionada || !maquinaDelProceso || activando) return;
    setActivando(true);
    try {
      const t = hayTarea && actividad ? onObtenerTiempos() : null;
      if (t) {
        await onGuardar(armarRegistro(t, parte, { maquina: maquinaDelProceso }));
        onReiniciarReloj();
      }
      const r = await fetch(`/api/tiempos/cola/${ordenSeleccionada.id}/lotes`, { method: 'POST' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(typeof d.error === 'string' ? d.error : 'No se pudo avisar. Probá de nuevo.');
        return;
      }
      await fetchOrdenes();
      toast.success('Listo: desde ahora cada bolsa va con su lote.');
    } catch {
      toast.error('No se pudo cerrar el tramo anterior. Probá de nuevo.');
    } finally {
      setActivando(false);
    }
  };

  const handleGuardar = async () => {
    if (!actividad || estado === 'idle' || faltaAlgo) return;

    const t = onObtenerTiempos();
    if (!t) return;

    try {
      await onGuardar(armarRegistro(t, parte));
      setActividad('');
      setOrdenId('');
      setDetalleLibre('');
      setParte('');
      setMaquina('');
      setDefectos('0');
      setInconveniente('');
      setInconvenienteNotas('');
      setShowInconv(false);
    } catch {
      toast.error('No se pudo guardar el registro. Probá de nuevo.');
    }
  };

  return (
    <div className="p-4 space-y-4">

      {/* Actividad */}
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Actividad</p>
      <div className="grid grid-cols-2 gap-2">
        {ACTIVIDADES.map(({ label, icon, color }) => (
          <button
            key={label}
            onClick={() => setActividad(label)}
            aria-pressed={actividad === label}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
              actividad === label
                ? color + ' ring-2 ring-offset-1 ring-stone-400'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            <span aria-hidden>{icon}</span>
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Órdenes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Orden / SKU</p>
          <button onClick={fetchOrdenes} className="text-xs text-stone-400 hover:text-stone-600 transition">
            Actualizar
          </button>
        </div>

        <div className="space-y-1.5">
          {ordenes.map((orden) => (
            <button
              key={claveFila(orden)}
              onClick={() => {
                if (ordenId === claveFila(orden)) {
                  setOrdenId('');
                  setParte('');
                } else {
                  setOrdenId(claveFila(orden));
                  // 🔴 La parte se preselecciona SÓLO con el reloj parado.
                  //
                  // Con el reloj corriendo, la orden se elige AL FINAL —así trabaja
                  // Marisol: arranca a coser y recién después dice qué era—. Ahí
                  // preseleccionar la primera pieza es AFIRMAR algo que nadie dijo:
                  // los minutos que ya corrieron quedan puestos en Corpiño, y como
                  // cambiar de pieza cierra el registro anterior, la única salida
                  // era guardar esos minutos en la pieza equivocada.
                  // Pasó en producción el 18-sep con 82 minutos.
                  setParte(estado === 'idle' ? (orden.partes?.[0] ?? '') : '');
                }
                setConfirmFin(false); setConfirmProceso(false);
              }}
              aria-pressed={ordenId === claveFila(orden)}
              aria-label={`Orden ${orden.sku ?? ''} ${orden.marca}${orden.descripcion ? ' — ' + orden.descripcion : ''}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95 ${
                ordenId === claveFila(orden) ? 'bg-amber-50 border-amber-400' : 'bg-white border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-stone-800">{orden.sku}</span>
                  {orden.lote != null && (
                    <span className="text-xs bg-stone-900 text-white px-1.5 py-0.5 rounded-full font-semibold">Lote {orden.lote}</span>
                  )}
                  <span className="text-xs text-stone-400">{orden.marca}</span>
                  {orden.estado === 'COSTURA' && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Costura</span>
                  )}
                </div>
                {orden.descripcion && (
                  <p className="text-xs text-stone-500 truncate mt-0.5">{orden.descripcion}</p>
                )}
              </div>
              <span className="text-xs text-stone-400 shrink-0">×{orden.cantidad}</span>
              {ordenId === claveFila(orden) && <span aria-hidden className="text-amber-500 text-base shrink-0">✓</span>}
            </button>
          ))}

          {ordenes.length === 0 && (
            <p className="text-xs text-stone-400 italic py-1">Sin órdenes activas en la cola</p>
          )}

          <button
            onClick={() => {
              setOrdenId(ordenId === LIBRE_ID ? '' : LIBRE_ID);
              setParte('');
              setConfirmFin(false); setConfirmProceso(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-all active:scale-95 ${
              ordenId === LIBRE_ID ? 'bg-stone-100 border-stone-400' : 'bg-white border-dashed border-stone-200 hover:border-stone-300'
            }`}
          >
            <span className="text-xs text-stone-400 font-medium">Sin orden — trabajo libre</span>
          </button>

          {esLibre && (
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">
                ¿Qué hiciste? {esProceso && <span className="text-amber-600">· obligatorio</span>}
              </label>
              <input
                value={detalleLibre}
                onChange={(e) => setDetalleLibre(e.target.value)}
                maxLength={200}
                placeholder="Planchado, arreglos…"
                className={`w-full px-3 py-2 border rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400 ${
                  faltaDetalle ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stone-200'
                }`}
              />
            </div>
          )}

          {/* "Terminé el remallado": fijo, al lado del aviso de terminé, sólo en las órdenes con
              una separación programada. Además de la pregunta que sale al cambiar de máquina. */}
          {ordenSeleccionada?.confirmarDespuesDe && maquinaDelProceso && (
            <div className="pt-1">
              {!confirmProceso ? (
                <button
                  onClick={() => setConfirmProceso(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-sky-300 text-sky-700 text-xs font-bold uppercase tracking-wide hover:bg-sky-50 transition active:scale-95"
                >
                  ✓ Terminé el {ordenSeleccionada.confirmarDespuesDe.toLowerCase()} — {ordenSeleccionada.sku}
                </button>
              ) : (
                <div className="bg-sky-50 border-2 border-sky-300 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-sky-900 text-center">
                    ¿Terminaste el {ordenSeleccionada.confirmarDespuesDe.toLowerCase()} de <span className="underline">todo</span>{' '}
                    <span className="font-mono">{ordenSeleccionada.sku}</span>?
                  </p>
                  <p className="text-[11px] text-sky-700 text-center leading-snug">
                    La orden se separa en lotes y cada bolsa va con el suyo.
                    {relojCorriendo && ' Lo que venías haciendo se guarda como ' + maquinaDelProceso + '.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => { await confirmarProcesoTerminado(); setConfirmProceso(false); }}
                      disabled={activando}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition active:scale-95"
                    >
                      {activando ? 'Guardando...' : 'Sí, terminé'}
                    </button>
                    <button
                      onClick={() => setConfirmProceso(false)}
                      className="px-4 py-2 rounded-lg border border-stone-200 text-stone-500 text-xs font-semibold hover:border-stone-400 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {ordenSeleccionada && ordenSeleccionada.estado === 'COSTURA' && (
            <div className="pt-1">
              {!confirmFin ? (
                <button
                  onClick={() => setConfirmFin(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 text-xs font-bold uppercase tracking-wide hover:bg-emerald-50 transition active:scale-95"
                >
                  ✓ Avisar que terminé {ordenSeleccionada.lote != null ? 'TODA la orden' : ''} — {ordenSeleccionada.sku}
                </button>
              ) : (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-emerald-800 text-center">
                    ¿Avisar que terminaste de coser <span className="font-mono">{ordenSeleccionada.sku}</span>?
                  </p>
                  <p className="text-[11px] text-emerald-700 text-center leading-snug">
                    Sale de tu lista y el taller la cuenta por talle. Si te equivocaste, avisales.
                  </p>
                  {errorFin && (
                    <p className="text-xs text-red-800 bg-red-100 border border-red-300 rounded-lg px-2 py-1.5 font-mono break-all">
                      {errorFin}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={marcarCosturaTerminada}
                      disabled={finalizando}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition active:scale-95"
                    >
                      {finalizando ? 'Avisando...' : 'Sí, avisar'}
                    </button>
                    <button
                      onClick={() => { setConfirmFin(false); setErrorFin(null); }}
                      className="px-4 py-2 rounded-lg border border-stone-200 text-stone-500 text-xs font-semibold hover:border-stone-400 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lote: lo pone el taller con la bolsa que le da; acá sólo se muestra */}
      {ordenSeleccionada && loteDelRegistro != null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-900 text-white">
          <span className="text-sm font-bold">Lote {loteDelRegistro}</span>
          <span className="text-[11px] opacity-70">lo que guardes va a esta bolsa — si cosés la otra, tocá su fila</span>
        </div>
      )}

      {/* Separación programada: se pregunta cuando el trabajo deja la máquina del proceso */}
      {preguntarSiTermino && (
        <div className="bg-sky-50 border-2 border-sky-300 rounded-xl p-3 space-y-2">
          <p className="text-sm font-bold text-sky-900 text-center leading-snug">
            ¿Terminaste el {ordenSeleccionada?.confirmarDespuesDe?.toLowerCase()} de <span className="underline">todo</span>{' '}
            <span className="font-mono">{ordenSeleccionada?.sku}</span>?
          </p>
          <p className="text-[11px] text-sky-700 text-center leading-snug">
            Si decís que sí, la orden se separa en lotes y cada bolsa va con el suyo.
            {relojCorriendo && ' Lo que venías haciendo se guarda como ' + maquinaDelProceso + '.'}
          </p>
          <div className="flex gap-2">
            <button onClick={confirmarProcesoTerminado} disabled={activando}
              className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-bold transition active:scale-95">
              {activando ? 'Guardando...' : 'Sí, terminé'}
            </button>
            <button onClick={() => setNoTerminoCon(maquina)} disabled={activando}
              className="px-4 py-2.5 rounded-lg border border-sky-300 text-sky-700 text-sm font-semibold hover:border-sky-400 transition">
              Todavía no
            </button>
          </div>
        </div>
      )}

      {/* Parte de la prenda — sólo en las que se cosen por partes (bikini) */}
      {partesDisponibles.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5">Qué parte estás cosiendo</p>
          <div className="grid grid-cols-2 gap-2">
            {partesDisponibles.map((p) => (
              <button
                key={p}
                onClick={() => pedirCambioParte(p)}
                disabled={cambiando}
                aria-pressed={parte === p}
                className={`py-3 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                  parte === p
                    ? 'bg-amber-50 border-amber-400 text-amber-800'
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => pedirCambioParte(PARTE_COMPARTIDA)}
              disabled={cambiando}
              aria-pressed={parte === PARTE_COMPARTIDA}
              className={`col-span-2 py-3 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
                parte === PARTE_COMPARTIDA
                  ? 'bg-sky-50 border-sky-400 text-sky-800'
                  : sugerirCompartido
                    ? 'bg-white border-sky-300 border-dashed text-sky-700'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              Las dos — el tubo{sugerirCompartido && parte !== PARTE_COMPARTIDA ? ' ←' : ''}
            </button>
          </div>
          <p className="text-[11px] text-stone-400 mt-1.5 leading-snug">
            {relojCorriendo && !parte
              ? '👆 Decí cuál estuviste cosiendo. Todavía no hay nada asignado, así que elegir acá no cierra ningún registro.'
              : sugerirCompartido && parte !== PARTE_COMPARTIDA
                ? `La tira de la cortacollareta va a ${partesDisponibles.join(' y ')}: ese rato se reparte entre las dos.`
                : relojCorriendo
                  ? 'Tocá la otra parte y se cierra sola la que venías haciendo: no hace falta parar.'
                  : 'Se guarda con cada registro, para saber cuánto lleva cada pieza.'}
          </p>
        </div>
      )}

      {/* Confirmación del cambio de pieza — cerrar un registro se confirma */}
      {confirmParte && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 space-y-2">
          <p className="text-sm font-bold text-amber-900 text-center leading-snug">
            {/* Abajo del minuto se muestran SEGUNDOS: decir "0 min" de un tramo que
                sí se va a guardar (ahora con decimales) haría dudar de si guardó algo. */}
            ¿Cerrás {confirmParte.minutos >= 1
              ? `${Math.round(confirmParte.minutos)} min`
              : `${Math.round(confirmParte.minutos * 60)} seg`} de{' '}
            <span className="underline">{parte || 'sin parte'}</span>
            {ordenSeleccionada?.sku && <> en <span className="font-mono">{ordenSeleccionada.sku}</span></>}?
          </p>
          <p className="text-[11px] text-amber-700 text-center leading-snug">
            Se guarda ese registro y el reloj sigue corriendo, ya en <strong>{confirmParte.nueva}</strong>.
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmarCambioParte}
              disabled={cambiando}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-bold transition active:scale-95"
            >
              {cambiando ? 'Guardando...' : `Sí, pasar a ${confirmParte.nueva}`}
            </button>
            <button
              onClick={() => setConfirmParte(null)}
              disabled={cambiando}
              className="px-4 py-2.5 rounded-lg border border-stone-300 text-stone-500 text-sm font-semibold hover:border-stone-400 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Resto del formulario */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">
            Máquina {ordenSeleccionada && <span className="text-amber-600">· obligatoria</span>}
          </label>
          {/* ⛔ Sin valor por default, ni siquiera cuando es obligatoria: un valor que
              pone la pantalla queda indistinguible de uno que eligió la persona. */}
          <select
            value={maquina}
            onChange={(e) => setMaquina(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400 ${
              faltaMaquina ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stone-200'
            }`}
          >
            <option value="">{ordenSeleccionada ? '— Elegí la máquina —' : '— Opcional —'}</option>
            {MAQUINAS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">Defectos</label>
          <NumInput
            value={parseFloat(defectos) || 0}
            onChange={(n) => setDefectos(n ? String(n) : '')}
            min="0"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Inconveniente */}
      <div>
        {!showInconv && !inconveniente && (
          <button
            type="button"
            onClick={() => setShowInconv(true)}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-200 text-amber-600 text-xs font-bold uppercase tracking-wide hover:bg-amber-50 transition active:scale-95"
          >
            ⚠ Reportar inconveniente
          </button>
        )}

        {(showInconv || inconveniente) && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">Inconveniente</p>
              <button
                type="button"
                onClick={() => { setInconveniente(''); setInconvenienteNotas(''); setShowInconv(false); }}
                className="text-xs text-amber-700 hover:text-amber-900 transition"
              >
                Quitar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {INCONVENIENTES.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInconveniente(opt)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-semibold transition active:scale-95 ${
                    inconveniente === opt
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-amber-200 text-amber-700 hover:border-amber-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              value={inconvenienteNotas}
              onChange={(e) => setInconvenienteNotas(e.target.value)}
              placeholder="Notas (opcional)"
              rows={2}
              className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-white via-white to-transparent">
        {hayTarea && !actividad && (
          <p className="text-xs text-amber-600 text-center mb-1.5 font-semibold">
            Elegí una actividad arriba para guardar ↑
          </p>
        )}
        {!hayTarea && (
          <p className="text-xs text-stone-400 text-center mb-1.5">
            Iniciá el cronómetro para registrar un trabajo
          </p>
        )}
        {hayTarea && faltaOrden && (
          <p className="text-xs text-amber-600 text-center mb-1.5 font-semibold">
            Elegí la orden — o &quot;Sin orden — trabajo libre&quot; ↑
          </p>
        )}
        {hayTarea && !faltaOrden && faltaDetalle && (
          <p className="text-xs text-amber-600 text-center mb-1.5 font-semibold">
            Escribí qué hiciste en el trabajo libre ↑
          </p>
        )}
        {hayTarea && actividad && faltaMaquina && (
          <p className="text-xs text-amber-600 text-center mb-1.5 font-semibold">
            Elegí la máquina para guardar — si no usaste ninguna, poné &quot;{MAQUINA_NINGUNA}&quot; ↑
          </p>
        )}
        <button
          onClick={handleGuardar}
          disabled={loading || !actividad || !hayTarea || faltaAlgo}
          className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-400 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
        >
          {loading ? 'Guardando...' : '✓ Guardar registro'}
        </button>
      </div>
    </div>
  );
}
