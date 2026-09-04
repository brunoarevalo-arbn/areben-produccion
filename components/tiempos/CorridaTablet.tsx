'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCronometro } from '@/lib/hooks/useCronometro';
import { NumInput } from '@/components/ui/NumInput';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { MAQUINAS } from '@/lib/constants/maquinas';
import { MOTIVOS_PARADA } from '@/lib/constants/paradas';

interface Paso { id: string; orden: number; nombre: string; maquina: string; nacidoEnCorrida: boolean }
interface Ribete { id: string; orden: number; nombre: string; anchoCm: number }
interface Corte { id: string; ribeteId: string | null; unidad: number; orden: number; largoCm: number }
export interface CorridaVista {
  id: string; nombre: string; tipoPrenda: string; marca: string; modo: string;
  talle: string; costurera: string; estado: string;
  unidadesObjetivo: number; unidadActual: number;
  pasos: Paso[]; ribetes: Ribete[]; cortes: Corte[];
  tubo: { utilCm: number; desperdicioCm: number; totalCm: number; mermaPct: number };
  abierto: { id: string; tipo: string; pasoId: string | null; maquina: string | null; motivo: string | null } | null;
  /** El paso al que vuelve "Reanudar": una pausa no abre un paso nuevo. */
  reanudar: { pasoId: string; nombre: string; maquina: string | null } | null;
  /** Segundos que el paso en curso ya lleva en esta prenda (tramos cerrados). */
  acumuladoSeg: number;
  resumen: {
    porPaso: { pasoId: string; nombre: string; maquina: string; porUnidad: { unidad: number; minutos: number }[] }[];
    unidades: { unidad: number; trabajo: number; paradas: number }[];
    minutosParadas: number;
  };
}

interface Siguiente {
  tipo: 'paso' | 'parada';
  pasoId?: string;
  nuevoPaso?: { nombre: string; maquina: string };
  maquina?: string;
  motivo?: string;
}

const fmt = (n: number) => n.toString().replace('.', ',');

const hhmmss = (seg: number) => {
  const t = Math.max(0, Math.floor(seg));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60]
    .map((n) => String(n).padStart(2, '0')).join(':');
};

/** El display del cronómetro son segundos: "HH:MM:SS" → 3661. */
const aSegundos = (display: string) =>
  display.split(':').reduce((t, n) => t * 60 + Number(n), 0);

export function CorridaTablet({ usuario, inicial }: { usuario: string; inicial: CorridaVista }) {
  const router = useRouter();
  const [c, setC] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Namespace propio: en esta misma tablet corre el cronómetro de costura.
  const cron = useCronometro(usuario, 'corrida');

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaMaquina, setNuevaMaquina] = useState<string>(MAQUINAS[0]);
  const [abrirNuevo, setAbrirNuevo] = useState(false);
  const [abrirParada, setAbrirParada] = useState(false);
  // El corte que se está por cargar: qué salió del tubo y cuántos cm.
  // `''` = desperdicio (vino una unión y no puede pasar).
  const [corteRibete, setCorteRibete] = useState<string>(inicial.ribetes[0]?.id ?? '');
  const [corteLargo, setCorteLargo] = useState(0);

  /**
   * El único gesto: cerrar el tramo que corre y abrir el que sigue. Los botones
   * de máquina, de paso, de parada y de fin de prenda son todos esto. El
   * cronómetro se reinicia acá y no lo toca la costurera.
   */
  const accion = async (siguiente: Siguiente | null, avanzarUnidad = false) => {
    if (ocupado) return;
    setOcupado(true); setError(null);

    const foto = cron.obtenerTiempos(2);
    const res = await fetch(`/api/tiempos/corrida/${c.id}/tramo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minutos: foto?.minutosNetos ?? 0,
        horaInicio: foto?.horaInicio,
        horaFin: foto?.horaFin,
        siguiente,
        avanzarUnidad,
      }),
    });
    setOcupado(false);

    if (!res.ok) { setError((await res.json()).error ?? 'No se pudo guardar'); return; }
    setC(await res.json());
    cron.descartar();
    if (siguiente) cron.iniciar();
    setAbrirNuevo(false); setAbrirParada(false); setNuevoNombre('');
  };

  const agregarCorte = async (ribeteId: string | null) => {
    if (ocupado || corteLargo <= 0) return;
    setOcupado(true); setError(null);
    const res = await fetch(`/api/tiempos/corrida/${c.id}/corte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ribeteId, unidad: c.unidadActual, largoCm: corteLargo }),
    });
    setOcupado(false);
    if (!res.ok) { setError((await res.json()).error ?? 'No se pudo cargar el corte'); return; }
    setC(await res.json());
    setCorteLargo(0);
  };

  const borrarCorte = async (corteId: string) => {
    setOcupado(true); setError(null);
    const res = await fetch(`/api/tiempos/corrida/${c.id}/corte?corteId=${corteId}`, { method: 'DELETE' });
    setOcupado(false);
    if (!res.ok) { setError((await res.json()).error ?? 'No se pudo borrar'); return; }
    setC(await res.json());
  };

  const terminar = async () => {
    const ok = await confirmAsync({
      message: '¿Terminar la corrida? No se van a poder medir más prendas.',
      confirmLabel: 'Terminar',
    });
    if (!ok) return;
    const foto = cron.obtenerTiempos(2);
    setOcupado(true);
    const res = await fetch(`/api/tiempos/corrida/${c.id}/terminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // La fecha va con el MISMO criterio con el que la tablet después pide los
      // registros del día (lib/api/tiempos.ts), o el registro no aparece en la lista.
      body: JSON.stringify({
        minutos: foto?.minutosNetos ?? 0,
        horaFin: foto?.horaFin,
        fecha: new Date().toISOString().split('T')[0],
      }),
    });
    setOcupado(false);
    if (!res.ok) { setError((await res.json()).error ?? 'No se pudo terminar'); return; }
    cron.descartar();
    router.push('/tiempos');
  };

  const abierto = c.abierto;
  const pasoAbierto = abierto?.pasoId ? c.pasos.find((p) => p.id === abierto.pasoId) : undefined;
  const minutosDe = (pasoId: string, unidad: number) =>
    c.resumen.porPaso.find((p) => p.pasoId === pasoId)?.porUnidad.find((u) => u.unidad === unidad)?.minutos ?? null;

  const esLaUltima = c.unidadActual >= c.unidadesObjetivo;
  const cortesDeLaPrenda = c.cortes.filter((t) => t.unidad === c.unidadActual).sort((a, b) => a.orden - b.orden);
  const relevamiento = c.modo === 'relevamiento';
  const enPausa = abierto?.tipo === 'parada';
  const segCron = aSegundos(cron.tiempoDisplay);
  const corriendo = cron.estado === 'corriendo';

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="bg-stone-900 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">
            {relevamiento ? 'Relevamiento' : 'Corrida de muestra'}
          </p>
          <p className="text-white font-semibold text-sm leading-tight truncate">{c.nombre} · {c.talle}</p>
          {c.unidadesObjetivo > 1 && (
            <p className="text-stone-400 text-xs">Prenda {c.unidadActual} de {c.unidadesObjetivo}</p>
          )}
        </div>
        <button onClick={() => router.push('/tiempos')}
          className="text-stone-400 hover:text-white text-xs border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition shrink-0">
          Salir
        </button>
      </header>

      {/* Cronómetro: no tiene botón de arrancar. Lo prende tocar un paso. */}
      <div className="bg-stone-900 mx-4 mt-3 rounded-xl px-5 py-4 shrink-0">
        {/* El número grande es el reloj del PASO, no el del tramo: sigue desde
            donde estaba al reanudar y al cambiar de máquina. En pausa se
            congela y abajo corre el reloj de la pausa, que va aparte. */}
        <p className={`text-center font-mono text-3xl font-bold tabular-nums ${corriendo && !enPausa ? 'text-amber-400' : 'text-stone-500'}`}>
          {hhmmss(c.acumuladoSeg + (abierto?.tipo === 'paso' ? segCron : 0))}
        </p>
        <p className="text-center text-xs mt-1 text-stone-400">
          {enPausa
            ? `⏸ En pausa · ${abierto?.motivo ?? 'Otro'} · ${hhmmss(segCron)}`
            : pasoAbierto
              ? `${pasoAbierto.nombre} · ${abierto?.maquina ?? pasoAbierto.maquina}`
              : 'Tocá un paso para arrancar'}
        </p>
        {c.resumen.minutosParadas > 0 && (
          <p className="text-center text-xs mt-1 text-sky-400">
            pausas de esta corrida: {fmt(c.resumen.minutosParadas)} min
          </p>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">{error}</div>
      )}

      {/* ── Pausa: se pausa y se reanuda ACÁ, sin cambiar de pantalla y sin
             declarar un paso nuevo. La pausa junta su tiempo aparte; reanudar
             vuelve a lo que se estaba haciendo. ─────────────────────────── */}
      <div className="mx-4 mt-3 shrink-0">
        {enPausa ? (
          <button
            onClick={() => c.reanudar && accion({ tipo: 'paso', pasoId: c.reanudar.pasoId, maquina: c.reanudar.maquina ?? undefined })}
            disabled={ocupado || !c.reanudar}
            className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm transition active:scale-95">
            ▶ Reanudar{c.reanudar ? ` · ${c.reanudar.nombre}` : ''}
          </button>
        ) : !abrirParada ? (
          <button onClick={() => setAbrirParada(true)} disabled={ocupado || !abierto}
            className="w-full py-3 rounded-xl border-2 border-dashed border-sky-300 text-sky-700 disabled:opacity-40 text-xs font-bold uppercase tracking-wide hover:bg-sky-50 transition active:scale-95">
            ⏸ Pausa
          </button>
        ) : (
          <div className="bg-white border-2 border-sky-300 rounded-xl p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">¿Por qué parás?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MOTIVOS_PARADA.map((m) => (
                <button key={m} onClick={() => accion({ tipo: 'parada', motivo: m })} disabled={ocupado}
                  className="px-3 py-2.5 rounded-xl border-2 border-stone-200 text-sm text-stone-700 hover:border-sky-300 transition active:scale-95">
                  {m}
                </button>
              ))}
            </div>
            <button onClick={() => setAbrirParada(false)}
              className="w-full py-2 mt-1 text-xs text-stone-400">Cancelar</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* ── Los pasos ─────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          {c.pasos.map((p) => {
            const abiertoAca = abierto?.pasoId === p.id;
            const hecho = minutosDe(p.id, c.unidadActual);
            return (
              <button key={p.id} onClick={() => accion({ tipo: 'paso', pasoId: p.id, maquina: p.maquina })}
                disabled={ocupado}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-95 disabled:opacity-60 ${
                  abiertoAca ? 'bg-amber-50 border-amber-400' : 'bg-white border-stone-200 hover:border-stone-300'
                }`}>
                <span className="text-xs text-stone-400 w-5 tabular-nums shrink-0">{p.orden}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm text-stone-800 truncate">{p.nombre}</span>
                  <span className="block text-xs text-stone-400">{p.maquina}</span>
                </span>
                <span className="text-sm tabular-nums shrink-0">
                  {abiertoAca ? <span className="text-amber-600">⏱</span>
                    : hecho != null ? <span className="text-stone-500">{fmt(hecho)} ✓</span>
                    : <span className="text-stone-300">—</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Relevamiento: el paso nace acá ─────────────────────────── */}
        {relevamiento && (
          !abrirNuevo ? (
            <button onClick={() => setAbrirNuevo(true)} disabled={ocupado}
              className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 text-xs font-bold uppercase tracking-wide hover:bg-amber-50 transition active:scale-95">
              + ¿Qué estás haciendo ahora?
            </button>
          ) : (
            <div className="bg-white border-2 border-amber-300 rounded-xl p-3 space-y-2">
              <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre del paso" autoFocus
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
              <div className="grid grid-cols-3 gap-1.5">
                {MAQUINAS.map((m) => (
                  <button key={m} onClick={() => setNuevaMaquina(m)}
                    className={`px-2 py-2 rounded-xl border-2 text-xs font-semibold transition active:scale-95 ${
                      nuevaMaquina === m ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'
                    }`}>{m}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => accion({ tipo: 'paso', nuevoPaso: { nombre: nuevoNombre.trim(), maquina: nuevaMaquina }, maquina: nuevaMaquina })}
                  disabled={ocupado || nuevoNombre.trim() === ''}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition active:scale-95">
                  Arrancar este paso
                </button>
                <button onClick={() => setAbrirNuevo(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-500 text-xs font-semibold">Cancelar</button>
              </div>
            </div>
          )
        )}

        {/* ── Máquina: cambia sin cortar el proceso ──────────────────── */}
        {abierto?.tipo === 'paso' && pasoAbierto && (
          <div className="bg-white border border-stone-200 rounded-xl p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">Máquina</p>
            <div className="grid grid-cols-3 gap-1.5">
              {MAQUINAS.map((m) => {
                const activa = (abierto.maquina ?? pasoAbierto.maquina) === m;
                return (
                  <button key={m} onClick={() => !activa && accion({ tipo: 'paso', pasoId: pasoAbierto.id, maquina: m })}
                    disabled={ocupado}
                    className={`px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition active:scale-95 disabled:opacity-60 ${
                      activa ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}>{m}</button>
                );
              })}
            </div>
            <p className="text-xs text-stone-400 mt-2">Tocá otra y seguís cosiendo: el reloj no se corta.</p>
          </div>
        )}

        {/* ── El tubo: la secuencia real de cortes ──────────────────── */}
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">
            Lo que sale del tubo{c.unidadesObjetivo > 1 ? ` · prenda ${c.unidadActual}` : ''}
          </p>
          <p className="text-xs text-stone-400 mb-3">
            En el orden en que lo cortás. Cuando viene una unión y no puede pasar, cargá lo que tirás
            como desperdicio.
          </p>

          {cortesDeLaPrenda.length > 0 && (
            <div className="space-y-1 mb-3">
              {cortesDeLaPrenda.map((t, i) => {
                const rb = t.ribeteId ? c.ribetes.find((r) => r.id === t.ribeteId) : null;
                return (
                  <div key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${rb ? 'bg-stone-50' : 'bg-red-50'}`}>
                    <span className="text-xs text-stone-400 w-4 tabular-nums shrink-0">{i + 1}</span>
                    <span className={`flex-1 min-w-0 truncate ${rb ? 'text-stone-700' : 'text-red-700 font-semibold'}`}>
                      {rb ? rb.nombre : '⚠ desperdicio'}
                    </span>
                    <span className="tabular-nums text-stone-600 shrink-0">{fmt(t.largoCm)} cm</span>
                    <button onClick={() => borrarCorte(t.id)} disabled={ocupado}
                      aria-label="Borrar corte" className="text-stone-300 hover:text-red-500 px-1 shrink-0">✕</button>
                  </div>
                );
              })}
              <div className="flex justify-between px-3 pt-1 text-xs text-stone-400">
                <span>útil {fmt(c.tubo.utilCm)} cm · desperdicio {fmt(c.tubo.desperdicioCm)} cm</span>
                <span className="font-semibold text-amber-600">merma {fmt(c.tubo.mermaPct)}%</span>
              </div>
            </div>
          )}

          {c.ribetes.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Esta corrida no tiene ribetes definidos. Los carga Diseño al encenderla.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {c.ribetes.map((r) => (
                  <button key={r.id} onClick={() => setCorteRibete(r.id)}
                    className={`px-3 py-2.5 rounded-xl border-2 text-left transition active:scale-95 ${
                      corteRibete === r.id ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-700'
                    }`}>
                    <span className="block text-sm font-semibold truncate">{r.nombre}</span>
                    <span className={`block text-xs ${corteRibete === r.id ? 'text-stone-400' : 'text-stone-400'}`}>
                      ancho {fmt(r.anchoCm)} cm
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <NumInput value={corteLargo} onChange={setCorteLargo} aria-label="Centímetros del corte"
                  placeholder="cm"
                  className="w-24 border border-stone-200 rounded-xl px-3 py-3 text-base text-center focus:outline-none focus:border-amber-400" />
                <button onClick={() => agregarCorte(corteRibete || null)}
                  disabled={ocupado || corteLargo <= 0 || !corteRibete}
                  className="flex-1 py-3 rounded-xl bg-stone-900 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wide active:scale-95">
                  + Ribete
                </button>
                <button onClick={() => agregarCorte(null)} disabled={ocupado || corteLargo <= 0}
                  className="flex-1 py-3 rounded-xl border-2 border-red-300 text-red-700 disabled:opacity-40 text-xs font-bold uppercase tracking-wide active:scale-95">
                  + Desperdicio
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-2">
                Poné los cm y tocá si fue ribete o desperdicio. El ancho lo define Diseño.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Cierre ────────────────────────────────────────────────────── */}
      {/* Con una sola prenda no existe una prenda 2: el botón cierra la corrida.
          Nombrar un paso que no va a pasar es peor que no tener el botón. */}
      <div className="bg-white border-t border-stone-200 px-4 py-3 shrink-0 space-y-2">
        {esLaUltima ? (
          <>
            <button onClick={terminar} disabled={ocupado}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm transition active:scale-95">
              ✓ Marcar como terminado
            </button>
            <button onClick={() => accion(null, true)} disabled={ocupado}
              className="w-full py-2 text-xs text-stone-400 hover:text-stone-700">
              Coser una prenda más
            </button>
          </>
        ) : (
          <button onClick={() => accion(null, true)} disabled={ocupado}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm transition active:scale-95">
            ✓ Terminé la prenda {c.unidadActual} de {c.unidadesObjetivo}
          </button>
        )}
      </div>
    </div>
  );
}
