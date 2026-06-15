'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { minutosAHorasMin } from '@/lib/utils/calculos';
import { INCONVENIENTES } from '@/lib/constants/inconvenientes';

interface Registro {
  id: string;
  usuario: string;
  actividad: string;
  maquina?: string;
  sku?: string;
  cantidad: number;
  defectos?: number;
  minutosNetos: number;
  horaInicio?: string;
  horaFin?: string;
  inconveniente?: string;
  inconvenienteNotas?: string;
}

interface ReporteData {
  fecha: string;
  totalRegistros: number;
  totalMinutos: number;
  totalPrendas: number;
  porCosturera: Record<string, { minutos: number; registros: number; prendas: number }>;
  porActividad: Record<string, { minutos: number; registros: number }>;
  porMaquina:   Record<string, { minutos: number; registros: number }>;
  porInconveniente:     Record<string, { registros: number; minutos: number }>;
  inconvenientesPorSku: Record<string, { registros: number; minutos: number; categorias: Record<string, number> }>;
  registros: Registro[];
}

const ACTIVIDADES = [
  'Proceso Completado',
  'Muestra Zattia',
  'Muestra Stunned',
  'Descanso',
  'Almuerzo',
  'Falla Máquina',
  'Cambio Hilo',
];

const MAQUINAS = ['Recta', 'Collareta', 'Remalladora', 'Cadeneta', 'Cortacollareta'];

function hoy() {
  return new Date().toISOString().split('T')[0];
}

export function ReportesClient({ isAdmin }: { isAdmin: boolean }) {
  const [fecha,   setFecha]   = useState(hoy());
  const [data,    setData]    = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [costureras, setCostureras] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/usuarios')
      .then((r) => (r.ok ? r.json() : []))
      .then((us) => {
        if (!Array.isArray(us)) return;
        setCostureras(
          us.filter((u) => u.rol === 'costurera' && u.activo).map((u) => u.nombre),
        );
      })
      .catch(() => {});
  }, [isAdmin]);

  const cargar = useCallback(async (f: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes?fecha=${f}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Producción</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Reportes diarios</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/produccion/reportes/sku"
            className="border border-stone-200 hover:border-stone-400 text-stone-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition">
            Costos por SKU →
          </Link>
          <Link href="/tiempos"
            className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
            + Registrar tiempos
          </Link>
        </div>
      </div>

      {/* Selector de fecha */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            const d = new Date(fecha);
            d.setDate(d.getDate() - 1);
            setFecha(d.toISOString().split('T')[0]);
          }}
          className="w-9 h-9 rounded-lg border border-stone-200 hover:border-stone-400 text-stone-500 flex items-center justify-center transition text-lg"
        >
          ‹
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
        />
        <button
          onClick={() => {
            const d = new Date(fecha);
            d.setDate(d.getDate() + 1);
            const nueva = d.toISOString().split('T')[0];
            if (nueva <= hoy()) setFecha(nueva);
          }}
          className="w-9 h-9 rounded-lg border border-stone-200 hover:border-stone-400 text-stone-500 flex items-center justify-center transition text-lg disabled:opacity-40"
          disabled={fecha >= hoy()}
        >
          ›
        </button>
        {fecha === hoy() && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">Hoy</span>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-stone-400 text-sm">Cargando...</div>
      )}

      {!loading && data && data.totalRegistros === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-stone-500 text-sm">Sin registros para esta fecha.</p>
          <Link href="/tiempos" className="inline-block mt-4 text-xs text-amber-600 hover:text-amber-800 font-semibold">
            Ir a registrar tiempos →
          </Link>
        </div>
      )}

      {!loading && data && data.totalRegistros > 0 && (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Registros', value: data.totalRegistros, color: 'text-stone-800' },
              { label: 'Tiempo total', value: minutosAHorasMin(data.totalMinutos), color: 'text-amber-700' },
              { label: 'Prendas', value: data.totalPrendas, color: 'text-emerald-700' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-5 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-stone-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Por costurera */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Por costurera</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-50 text-xs text-stone-400">
                  <th className="px-5 py-2 text-left font-semibold">Costurera</th>
                  <th className="px-5 py-2 text-center font-semibold">Registros</th>
                  <th className="px-5 py-2 text-center font-semibold">Tiempo</th>
                  <th className="px-5 py-2 text-right font-semibold">Prendas</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.porCosturera)
                  .sort((a, b) => b[1].minutos - a[1].minutos)
                  .map(([nombre, stats]) => (
                    <tr key={nombre} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-5 py-3 font-medium text-stone-800">{nombre}</td>
                      <td className="px-5 py-3 text-center text-stone-500">{stats.registros}</td>
                      <td className="px-5 py-3 text-center font-semibold text-amber-700">{minutosAHorasMin(stats.minutos)}</td>
                      <td className="px-5 py-3 text-right font-bold text-stone-800">{stats.prendas}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Por actividad */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Por actividad</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-50 text-xs text-stone-400">
                  <th className="px-5 py-2 text-left font-semibold">Actividad</th>
                  <th className="px-5 py-2 text-center font-semibold">Registros</th>
                  <th className="px-5 py-2 text-right font-semibold">Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.porActividad)
                  .sort((a, b) => b[1].minutos - a[1].minutos)
                  .map(([actividad, stats]) => (
                    <tr key={actividad} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-5 py-3 font-medium text-stone-800">{actividad}</td>
                      <td className="px-5 py-3 text-center text-stone-500">{stats.registros}</td>
                      <td className="px-5 py-3 text-right font-semibold text-amber-700">{minutosAHorasMin(stats.minutos)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Por máquina */}
          {Object.keys(data.porMaquina).length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100">
                <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Por máquina</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-50 text-xs text-stone-400">
                    <th className="px-5 py-2 text-left font-semibold">Máquina</th>
                    <th className="px-5 py-2 text-center font-semibold">Registros</th>
                    <th className="px-5 py-2 text-right font-semibold">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.porMaquina)
                    .sort((a, b) => b[1].minutos - a[1].minutos)
                    .map(([maquina, stats]) => (
                      <tr key={maquina} className="border-b border-stone-50 hover:bg-stone-50">
                        <td className="px-5 py-3 font-medium text-stone-800">{maquina}</td>
                        <td className="px-5 py-3 text-center text-stone-500">{stats.registros}</td>
                        <td className="px-5 py-3 text-right font-semibold text-amber-700">{minutosAHorasMin(stats.minutos)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Inconvenientes */}
          {Object.keys(data.porInconveniente).length > 0 && (
            <div className="bg-amber-50/40 rounded-2xl border border-amber-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-amber-800">⚠ Inconvenientes del día</h2>
                <span className="text-xs text-amber-700 font-semibold">
                  {Object.values(data.porInconveniente).reduce((s, v) => s + v.registros, 0)} registros · {minutosAHorasMin(Object.values(data.porInconveniente).reduce((s, v) => s + v.minutos, 0))}
                </span>
              </div>

              {/* Por categoría */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-100 text-xs text-amber-700">
                    <th className="px-5 py-2 text-left font-semibold">Categoría</th>
                    <th className="px-5 py-2 text-center font-semibold">Registros</th>
                    <th className="px-5 py-2 text-right font-semibold">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.porInconveniente)
                    .sort((a, b) => b[1].registros - a[1].registros)
                    .map(([cat, stats]) => (
                      <tr key={cat} className="border-b border-amber-100 hover:bg-amber-50">
                        <td className="px-5 py-3 font-medium text-amber-900">{cat}</td>
                        <td className="px-5 py-3 text-center text-amber-700">{stats.registros}</td>
                        <td className="px-5 py-3 text-right font-semibold text-amber-700">{minutosAHorasMin(stats.minutos)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Por SKU */}
              {Object.keys(data.inconvenientesPorSku).length > 0 && (
                <div className="border-t border-amber-200">
                  <div className="px-5 py-2 bg-amber-50/60">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Por SKU</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-100 text-xs text-amber-700">
                        <th className="px-5 py-2 text-left font-semibold">SKU</th>
                        <th className="px-5 py-2 text-left font-semibold">Categorías</th>
                        <th className="px-5 py-2 text-center font-semibold">Registros</th>
                        <th className="px-5 py-2 text-right font-semibold">Tiempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.inconvenientesPorSku)
                        .sort((a, b) => b[1].registros - a[1].registros)
                        .map(([sku, stats]) => (
                          <tr key={sku} className="border-b border-amber-100 hover:bg-amber-50">
                            <td className="px-5 py-3 font-mono text-xs font-bold text-amber-900">{sku}</td>
                            <td className="px-5 py-3 text-xs text-amber-800">
                              {Object.entries(stats.categorias)
                                .sort((a, b) => b[1] - a[1])
                                .map(([cat, n]) => `${cat} (${n})`)
                                .join(', ')}
                            </td>
                            <td className="px-5 py-3 text-center text-amber-700">{stats.registros}</td>
                            <td className="px-5 py-3 text-right font-semibold text-amber-700">{minutosAHorasMin(stats.minutos)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Detalle */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Detalle de registros</h2>
              {isAdmin && !adding && (
                <button onClick={() => { setEditId(null); setAdding(true); }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:border-amber-400 hover:text-amber-700 transition font-semibold">
                  + Agregar registro
                </button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-50 text-xs text-stone-400">
                  <th className="px-5 py-2 text-left font-semibold">Costurera</th>
                  <th className="px-5 py-2 text-left font-semibold">Actividad</th>
                  <th className="px-5 py-2 text-left font-semibold">SKU</th>
                  <th className="px-5 py-2 text-left font-semibold">Máquina</th>
                  <th className="px-5 py-2 text-center font-semibold">Horario</th>
                  <th className="px-5 py-2 text-center font-semibold">Tiempo</th>
                  <th className="px-5 py-2 text-right font-semibold">Prendas</th>
                  {isAdmin && <th className="px-5 py-2 text-right font-semibold w-24" />}
                </tr>
              </thead>
              <tbody>
                {adding && (
                  <NewRow
                    fecha={fecha}
                    costureras={costureras}
                    onCancel={() => setAdding(false)}
                    onSaved={() => { setAdding(false); cargar(fecha); }}
                  />
                )}
                {data.registros.map((r) => (
                  editId === r.id ? (
                    <EditRow key={r.id} registro={r} onCancel={() => setEditId(null)} onSaved={() => { setEditId(null); cargar(fecha); }} />
                  ) : (
                    <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-5 py-2.5 font-medium text-stone-700">{r.usuario}</td>
                      <td className="px-5 py-2.5 text-stone-600">
                        {r.actividad}
                        {r.inconveniente && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
                            title={r.inconvenienteNotas ?? r.inconveniente}>
                            ⚠ {r.inconveniente}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-stone-500 font-mono text-xs">{r.sku ?? '—'}</td>
                      <td className="px-5 py-2.5 text-stone-500 text-xs">{r.maquina ?? '—'}</td>
                      <td className="px-5 py-2.5 text-center text-stone-400 text-xs">
                        {r.horaInicio && r.horaFin ? `${r.horaInicio} – ${r.horaFin}` : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-center text-amber-700 font-medium">{minutosAHorasMin(r.minutosNetos)}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-stone-700">{r.cantidad}</td>
                      {isAdmin && (
                        <td className="px-5 py-2.5 text-right">
                          <button onClick={() => setEditId(r.id)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700 transition">
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EditRow({ registro, onCancel, onSaved }: { registro: Registro; onCancel: () => void; onSaved: () => void }) {
  const [actividad,  setActividad]  = useState(registro.actividad);
  const [sku,        setSku]        = useState(registro.sku ?? '');
  const [maquina,    setMaquina]    = useState(registro.maquina ?? '');
  const [horaInicio, setHoraInicio] = useState(registro.horaInicio ?? '');
  const [horaFin,    setHoraFin]    = useState(registro.horaFin ?? '');
  const [cantidad,   setCantidad]   = useState(String(registro.cantidad));
  const [defectos,   setDefectos]   = useState(String(registro.defectos ?? 0));
  const [inconv,      setInconv]      = useState(registro.inconveniente ?? '');
  const [inconvNotas, setInconvNotas] = useState(registro.inconvenienteNotas ?? '');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const guardar = async () => {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      actividad,
      cantidad: parseInt(cantidad) || 0,
      defectos: parseInt(defectos) || 0,
      sku:     sku.trim()     ? sku.trim()     : null,
      maquina: maquina.trim() ? maquina.trim() : null,
      inconveniente:      inconv ? inconv : null,
      inconvenienteNotas: inconv && inconvNotas.trim() ? inconvNotas.trim() : null,
    };
    if (horaInicio) body.horaInicio = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio;
    if (horaFin)    body.horaFin    = horaFin.length    === 5 ? `${horaFin}:00`    : horaFin;
    try {
      const r = await fetch(`/api/tiempos/${registro.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Error al guardar');
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError('Error de red');
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-2 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-amber-400';

  return (
    <tr className="bg-amber-50/40 border-b border-stone-50">
      <td colSpan={8} className="px-5 py-3">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">Editando — {registro.usuario}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="text-xs text-stone-500">
              Actividad
              <select value={actividad} onChange={(e) => setActividad(e.target.value)} className={inputCls + ' mt-0.5'}>
                {ACTIVIDADES.map((a) => <option key={a}>{a}</option>)}
                {!ACTIVIDADES.includes(actividad) && <option>{actividad}</option>}
              </select>
            </label>
            <label className="text-xs text-stone-500">
              Máquina
              <select value={maquina} onChange={(e) => setMaquina(e.target.value)} className={inputCls + ' mt-0.5'}>
                <option value="">—</option>
                {MAQUINAS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="text-xs text-stone-500">
              SKU
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Cantidad
              <input type="number" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Hora inicio
              <input type="time" value={horaInicio} onChange={(e) => { setHoraInicio(e.target.value); setError(null); }} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Hora fin
              <input type="time" value={horaFin} onChange={(e) => { setHoraFin(e.target.value); setError(null); }} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Defectos
              <input type="number" min="0" value={defectos} onChange={(e) => setDefectos(e.target.value)} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500 col-span-2 md:col-span-2">
              Inconveniente
              <select value={inconv} onChange={(e) => setInconv(e.target.value)} className={inputCls + ' mt-0.5'}>
                <option value="">— Ninguno —</option>
                {INCONVENIENTES.map((opt) => <option key={opt}>{opt}</option>)}
                {inconv && !INCONVENIENTES.includes(inconv as typeof INCONVENIENTES[number]) && <option>{inconv}</option>}
              </select>
            </label>
            <label className="text-xs text-stone-500 col-span-2 md:col-span-2">
              Notas inconveniente
              <input type="text" value={inconvNotas} onChange={(e) => setInconvNotas(e.target.value)} disabled={!inconv}
                className={inputCls + ' mt-0.5 disabled:bg-stone-50 disabled:text-stone-400'} />
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-xs text-stone-400 italic">Si cambiás las horas, los minutos se recalculan automáticamente.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 transition">
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 transition font-semibold">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function NewRow({ fecha, costureras, onCancel, onSaved }: { fecha: string; costureras: string[]; onCancel: () => void; onSaved: () => void }) {
  const [usuario,    setUsuario]    = useState(costureras[0] ?? '');
  const [actividad,  setActividad]  = useState(ACTIVIDADES[0]);
  const [sku,        setSku]        = useState('');
  const [maquina,    setMaquina]    = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin,    setHoraFin]    = useState('');
  const [cantidad,   setCantidad]   = useState('0');
  const [defectos,   setDefectos]   = useState('0');
  const [inconv,      setInconv]      = useState('');
  const [inconvNotas, setInconvNotas] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const guardar = async () => {
    if (!usuario.trim()) { setError('Elegí una costurera'); return; }
    if (!horaInicio || !horaFin) { setError('Ingresá hora de inicio y fin'); return; }
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      usuario,
      actividad,
      fecha,
      cantidad: parseInt(cantidad) || 0,
      defectos: parseInt(defectos) || 0,
      sku:     sku.trim()     ? sku.trim()     : undefined,
      maquina: maquina.trim() ? maquina.trim() : undefined,
      horaInicio: horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio,
      horaFin:    horaFin.length    === 5 ? `${horaFin}:00`    : horaFin,
      inconveniente:      inconv ? inconv : undefined,
      inconvenienteNotas: inconv && inconvNotas.trim() ? inconvNotas.trim() : undefined,
    };
    try {
      const r = await fetch('/api/tiempos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Error al guardar');
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError('Error de red');
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-2 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-amber-400';

  return (
    <tr className="bg-amber-50/40 border-b border-stone-50">
      <td colSpan={8} className="px-5 py-3">
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">Nuevo registro manual</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="text-xs text-stone-500">
              Costurera
              <select value={usuario} onChange={(e) => setUsuario(e.target.value)} className={inputCls + ' mt-0.5'}>
                {costureras.length === 0 && <option value="">— Sin costureras —</option>}
                {costureras.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs text-stone-500">
              Actividad
              <select value={actividad} onChange={(e) => setActividad(e.target.value)} className={inputCls + ' mt-0.5'}>
                {ACTIVIDADES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className="text-xs text-stone-500">
              Máquina
              <select value={maquina} onChange={(e) => setMaquina(e.target.value)} className={inputCls + ' mt-0.5'}>
                <option value="">—</option>
                {MAQUINAS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="text-xs text-stone-500">
              SKU
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Hora inicio
              <input type="time" value={horaInicio} onChange={(e) => { setHoraInicio(e.target.value); setError(null); }} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Hora fin
              <input type="time" value={horaFin} onChange={(e) => { setHoraFin(e.target.value); setError(null); }} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Cantidad
              <input type="number" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500">
              Defectos
              <input type="number" min="0" value={defectos} onChange={(e) => setDefectos(e.target.value)} className={inputCls + ' mt-0.5'} />
            </label>
            <label className="text-xs text-stone-500 col-span-2">
              Inconveniente
              <select value={inconv} onChange={(e) => setInconv(e.target.value)} className={inputCls + ' mt-0.5'}>
                <option value="">— Ninguno —</option>
                {INCONVENIENTES.map((opt) => <option key={opt}>{opt}</option>)}
              </select>
            </label>
            <label className="text-xs text-stone-500 col-span-2">
              Notas inconveniente
              <input type="text" value={inconvNotas} onChange={(e) => setInconvNotas(e.target.value)} disabled={!inconv}
                className={inputCls + ' mt-0.5 disabled:bg-stone-50 disabled:text-stone-400'} />
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-xs text-stone-400 italic">Los minutos se calculan automáticamente desde el horario. Fecha: {fecha}.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:border-stone-400 transition">
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 transition font-semibold">
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
