'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface DatosSKU {
  sku: string; marca: string;
  minutosNetos: number; minutosTotal: number;
  unidades: number; defectos: number;
  porMaquina: Record<string, number>;
}

interface Datos {
  totalMinutos: number; totalUnidades: number; totalDefectos: number;
  porMaquina:   Record<string, { minutos: number; unidades: number }>;
  porActividad: Record<string, number>;
  porCosturera: Record<string, { minutos: number; unidades: number; defectos: number }>;
  porSku:       DatosSKU[];
}

const MARCAS = ['Zattia', 'Stunned'];

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function Productividad() {
  const [datos,   setDatos]   = useState<Datos | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde,   setDesde]   = useState('');
  const [hasta,   setHasta]   = useState('');
  const [marca,   setMarca]   = useState('');
  const [tab,     setTab]     = useState<'taller' | 'sku'>('taller');

  const cargar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (marca) params.set('marca', marca);
    const r = await fetch(`/api/costos/productividad?${params}`);
    if (r.ok) setDatos(await r.json());
    setLoading(false);
  }, [desde, hasta, marca]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input type="date" label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <Select label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="">Todas</option>
          {MARCAS.map((m) => <option key={m}>{m}</option>)}
        </Select>
        <Button onClick={cargar}>
          Aplicar
        </Button>
        {(desde || hasta || marca) && (
          <Button variant="secondary" onClick={() => { setDesde(''); setHasta(''); setMarca(''); }}>
            Limpiar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400 text-sm">Calculando...</div>
      ) : !datos ? (
        <div className="text-center py-16 text-stone-400 text-sm">Sin datos</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Tiempo neto', value: fmt(datos.totalMinutos), sub: 'en producción' },
              { label: 'Unidades', value: datos.totalUnidades.toLocaleString('es-AR'), sub: 'producidas' },
              { label: 'Tasa de calidad', value: datos.totalUnidades > 0 ? `${(((datos.totalUnidades - datos.totalDefectos) / datos.totalUnidades) * 100).toFixed(1)}%` : '—', sub: `${datos.totalDefectos} defectos` },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-stone-200 p-5 text-center">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">{k.label}</p>
                <p className="text-3xl font-bold text-stone-900">{k.value}</p>
                <p className="text-xs text-stone-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {(['taller', 'sku'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${tab === t ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
                {t === 'taller' ? 'Taller & costureras' : 'Por SKU'}
              </button>
            ))}
          </div>

          {tab === 'taller' && (
            <div className="grid grid-cols-2 gap-5">
              {/* Por máquina */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Por máquina</p>
                </div>
                {Object.entries(datos.porMaquina).sort((a, b) => b[1].minutos - a[1].minutos).map(([maq, v]) => (
                  <div key={maq} className="px-5 py-3 border-t border-stone-100 first:border-0 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-stone-700">{maq}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-stone-900">{fmt(v.minutos)}</p>
                      <p className="text-xs text-stone-400">{v.unidades} u.</p>
                    </div>
                  </div>
                ))}
                {Object.keys(datos.porMaquina).length === 0 && (
                  <p className="px-5 py-8 text-center text-stone-400 text-sm">Sin registros</p>
                )}
              </div>

              {/* Por costurera */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Por costurera</p>
                </div>
                {Object.entries(datos.porCosturera).sort((a, b) => b[1].minutos - a[1].minutos).map(([nombre, v]) => (
                  <div key={nombre} className="px-5 py-3 border-t border-stone-100 first:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-stone-700">{nombre}</span>
                      <span className="text-sm font-bold text-stone-900">{fmt(v.minutos)}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-stone-400">
                      <span>{v.unidades} unidades</span>
                      <span>{v.defectos} defectos</span>
                      {v.unidades > 0 && <span>{((v.defectos / v.unidades) * 100).toFixed(1)}% def.</span>}
                    </div>
                  </div>
                ))}
                {Object.keys(datos.porCosturera).length === 0 && (
                  <p className="px-5 py-8 text-center text-stone-400 text-sm">Sin registros</p>
                )}
              </div>
            </div>
          )}

          {tab === 'sku' && (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
                <span>SKU</span>
                <span className="text-right">T. neto prod.</span>
                <span className="text-right">T. total</span>
                <span className="text-right">Prom/u.</span>
                <span className="text-right">Unidades</span>
                <span className="text-right">Defectos</span>
              </div>
              {datos.porSku.length === 0 && (
                <p className="px-5 py-10 text-center text-stone-400 text-sm">Sin registros con SKU</p>
              )}
              {datos.porSku.map((s, i) => (
                <div key={s.sku} className={`px-5 py-4 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center ${i !== 0 ? 'border-t border-stone-100' : ''}`}>
                  <div>
                    <p className="font-mono font-bold text-sm text-stone-800">{s.sku}</p>
                    <p className="text-xs text-stone-400">{s.marca}</p>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {Object.entries(s.porMaquina).map(([maq, min]) => (
                        <span key={maq} className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">{maq}: {fmt(min)}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-violet-700 text-right tabular-nums">{fmt(s.minutosNetos)}</span>
                  <span className="text-sm text-stone-600 text-right tabular-nums">{fmt(s.minutosTotal)}</span>
                  <span className="text-sm text-stone-600 text-right tabular-nums">
                    {s.unidades > 0 ? fmt(s.minutosNetos / s.unidades) : '—'}
                  </span>
                  <span className="text-sm font-semibold text-stone-700 text-right tabular-nums">{s.unidades}</span>
                  <span className={`text-sm text-right tabular-nums font-semibold ${s.defectos > 0 ? 'text-red-500' : 'text-stone-300'}`}>{s.defectos}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
