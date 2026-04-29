'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { minutosAHorasMin } from '@/lib/utils/calculos';

interface ReporteData {
  fecha: string;
  totalRegistros: number;
  totalMinutos: number;
  totalPrendas: number;
  porCosturera: Record<string, { minutos: number; registros: number; prendas: number }>;
  porActividad: Record<string, { minutos: number; registros: number }>;
  porMaquina:   Record<string, { minutos: number; registros: number }>;
  registros: {
    id: string;
    usuario: string;
    actividad: string;
    maquina?: string;
    cantidad: number;
    minutosNetos: number;
    horaInicio?: string;
    horaFin?: string;
  }[];
}

function hoy() {
  return new Date().toISOString().split('T')[0];
}

export default function ReportesPage() {
  const [fecha,   setFecha]   = useState(hoy());
  const [data,    setData]    = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(false);

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
        <Link href="/tiempos"
          className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
          + Registrar tiempos
        </Link>
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

          {/* Detalle */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Detalle de registros</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-50 text-xs text-stone-400">
                  <th className="px-5 py-2 text-left font-semibold">Costurera</th>
                  <th className="px-5 py-2 text-left font-semibold">Actividad</th>
                  <th className="px-5 py-2 text-center font-semibold">Horario</th>
                  <th className="px-5 py-2 text-center font-semibold">Tiempo</th>
                  <th className="px-5 py-2 text-right font-semibold">Prendas</th>
                </tr>
              </thead>
              <tbody>
                {data.registros.map((r) => (
                  <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-5 py-2.5 font-medium text-stone-700">{r.usuario}</td>
                    <td className="px-5 py-2.5 text-stone-600">{r.actividad}</td>
                    <td className="px-5 py-2.5 text-center text-stone-400 text-xs">
                      {r.horaInicio && r.horaFin ? `${r.horaInicio} – ${r.horaFin}` : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-center text-amber-700 font-medium">{minutosAHorasMin(r.minutosNetos)}</td>
                    <td className="px-5 py-2.5 text-right font-bold text-stone-700">{r.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
