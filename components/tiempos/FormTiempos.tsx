'use client';

import { useState, useEffect, useCallback } from 'react';
import { TiemposProduccion } from '@/types/tiempos';
import type { EstadoCronometro } from '@/lib/hooks/useTiempos';
import { INCONVENIENTES } from '@/lib/constants/inconvenientes';
import { MAQUINAS } from '@/lib/constants/maquinas';
import { PARTE_COMPARTIDA, MAQUINA_COMPARTIDA } from '@/lib/constants/partes';
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
}

const ACTIVIDADES: { label: string; icon: string; color: string }[] = [
  { label: 'Proceso Completado', icon: '✅', color: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
  { label: 'Muestra Zattia',     icon: '📐', color: 'bg-violet-50 border-violet-400 text-violet-800' },
  { label: 'Muestra Stunned',    icon: '📐', color: 'bg-pink-50 border-pink-400 text-pink-800' },
  { label: 'Descanso',           icon: '☕', color: 'bg-sky-50 border-sky-400 text-sky-800' },
  { label: 'Almuerzo',           icon: '🍽️', color: 'bg-orange-50 border-orange-400 text-orange-800' },
  { label: 'Falla Máquina',      icon: '⚠️', color: 'bg-red-50 border-red-400 text-red-800' },
  { label: 'Cambio Hilo',        icon: '🧵', color: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
];

const LIBRE_ID = '__libre__';

export function FormTiempos({ usuario, ordenesIniciales, estado, onObtenerTiempos, onGuardar, onRefresh, onReiniciarReloj, loading }: FormTiemposProps) {
  const [actividad,   setActividad]   = useState('');
  const [ordenId,     setOrdenId]     = useState('');
  const [parte,       setParte]       = useState('');
  const [cambiando,   setCambiando]   = useState(false);
  const [confirmParte, setConfirmParte] = useState<{ nueva: string; minutos: number } | null>(null);
  const [maquina,     setMaquina]     = useState('');
  const [cantidad,    setCantidad]    = useState('1');
  const [defectos,    setDefectos]    = useState('0');
  const [ordenes,     setOrdenes]     = useState<OrdenActiva[]>(ordenesIniciales);
  const [finalizando, setFinalizando] = useState(false);
  const [confirmFin,  setConfirmFin]  = useState(false);
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

  const ordenSeleccionada = ordenes.find((o) => o.id === ordenId) ?? null;
  const partesDisponibles = ordenSeleccionada?.partes ?? [];
  const relojCorriendo = estado !== 'idle' && !!actividad;
  // El tubo sale de la cortacollareta de una vez y la tira va a las dos piezas ⇒
  // hay una opción más que ⛔ no es una pieza. Se OFRECE siempre (la máquina se
  // elige abajo y podría cambiarse después) y se SUGIERE cuando la máquina es ésa,
  // pero ⛔ nunca se asigna sola: asignarla sola mandaría a "Compartido" un tramo
  // que se venía cosiendo de una pieza, sin que nadie lo confirme.
  const sugerirCompartido = partesDisponibles.length > 0 && maquina === MAQUINA_COMPARTIDA;
  // Hay un cronómetro abierto (corriendo o en pausa) listo para guardarse.
  const hayTarea = estado !== 'idle';

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
  ): TiemposProduccion => ({
    usuario,
    actividad,
    fecha:        new Date().toISOString().split('T')[0],
    marca:        ordenSeleccionada?.marca   || undefined,
    maquina:      maquina                   || undefined,
    sku:          ordenSeleccionada?.sku     || undefined,
    parte:        parteDelRegistro          || undefined,
    cantidad:     parseInt(cantidad) || 0,
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

  const handleGuardar = async () => {
    if (!actividad || estado === 'idle') return;

    const t = onObtenerTiempos();
    if (!t) return;

    try {
      await onGuardar(armarRegistro(t, parte));
      setActividad('');
      setOrdenId('');
      setParte('');
      setMaquina('');
      setCantidad('1');
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
              key={orden.id}
              onClick={() => {
                if (ordenId === orden.id) {
                  setOrdenId('');
                  setCantidad('1');
                  setParte('');
                } else {
                  setOrdenId(orden.id);
                  setCantidad(String(orden.cantidad));
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
                setConfirmFin(false);
              }}
              aria-pressed={ordenId === orden.id}
              aria-label={`Orden ${orden.sku ?? ''} ${orden.marca}${orden.descripcion ? ' — ' + orden.descripcion : ''}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95 ${
                ordenId === orden.id ? 'bg-amber-50 border-amber-400' : 'bg-white border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-stone-800">{orden.sku}</span>
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
              {ordenId === orden.id && <span aria-hidden className="text-amber-500 text-base shrink-0">✓</span>}
            </button>
          ))}

          {ordenes.length === 0 && (
            <p className="text-xs text-stone-400 italic py-1">Sin órdenes activas en la cola</p>
          )}

          <button
            onClick={() => {
              setOrdenId(ordenId === LIBRE_ID ? '' : LIBRE_ID);
              setCantidad('1');
              setParte('');
              setConfirmFin(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-all active:scale-95 ${
              ordenId === LIBRE_ID ? 'bg-stone-100 border-stone-400' : 'bg-white border-dashed border-stone-200 hover:border-stone-300'
            }`}
          >
            <span className="text-xs text-stone-400 font-medium">Sin orden — trabajo libre</span>
          </button>

          {ordenSeleccionada && ordenSeleccionada.estado === 'COSTURA' && (
            <div className="pt-1">
              {!confirmFin ? (
                <button
                  onClick={() => setConfirmFin(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 text-xs font-bold uppercase tracking-wide hover:bg-emerald-50 transition active:scale-95"
                >
                  ✓ Avisar que terminé — {ordenSeleccionada.sku}
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
        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">Máquina</label>
          <select
            value={maquina}
            onChange={(e) => setMaquina(e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400"
          >
            <option value="">— Opcional —</option>
            {MAQUINAS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wide">Cantidad</label>
          <NumInput
            value={parseFloat(cantidad) || 0}
            onChange={(n) => setCantidad(n ? String(n) : '')}
            min="0"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:border-amber-400"
          />
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
        <button
          onClick={handleGuardar}
          disabled={loading || !actividad || !hayTarea}
          className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-400 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
        >
          {loading ? 'Guardando...' : '✓ Guardar registro'}
        </button>
      </div>
    </div>
  );
}
