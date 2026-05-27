'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RolloDisp {
  id: string; codigo: string; pesoActual: string; costoUnitario: string;
  insumo: { nombre: string; rinde: string | null }; color: { nombre: string } | null;
}

interface ConsumoRollo { rolloId: string; metrosUsados: string; codigo: string; pesoActual: number; costoUnitario: number; rinde: number; nombre: string; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function ConsumoTelaForm({ ordenId, sku }: { ordenId: string; sku: string }) {
  const router = useRouter();
  const [rollosDisp, setRollosDisp] = useState<RolloDisp[]>([]);
  const [consumoRollos, setConsumoRollos] = useState<ConsumoRollo[]>([]);
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/rollos?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
    ]).then(([r1, r2]) => {
      const all = [...r1, ...r2] as RolloDisp[];
      setRollosDisp(all.filter((r) => r.insumo.rinde && Number(r.insumo.rinde) > 0).sort((a, b) => a.codigo.localeCompare(b.codigo)));
    });
  }, []);

  const toggleRollo = (r: RolloDisp) => {
    setConsumoRollos((prev) => {
      const exists = prev.find((c) => c.rolloId === r.id);
      if (exists) return prev.filter((c) => c.rolloId !== r.id);
      const rinde = Number(r.insumo.rinde);
      return [...prev, {
        rolloId: r.id, metrosUsados: '', codigo: r.codigo,
        pesoActual: Number(r.pesoActual), costoUnitario: Number(r.costoUnitario),
        rinde, nombre: `${r.insumo.nombre}${r.color ? ` · ${r.color.nombre}` : ''}`,
      }];
    });
  };

  const updateMetros = (rolloId: string, val: string) => {
    setConsumoRollos((prev) => prev.map((c) => c.rolloId === rolloId ? { ...c, metrosUsados: val } : c));
  };

  const totalMetros = consumoRollos.reduce((s, c) => s + (parseFloat(c.metrosUsados) || 0), 0);
  const totalKg = consumoRollos.reduce((s, c) => {
    const m = parseFloat(c.metrosUsados) || 0;
    return s + m / c.rinde;
  }, 0);
  const costoTela = consumoRollos.reduce((s, c) => {
    const m = parseFloat(c.metrosUsados) || 0;
    const kg = m / c.rinde;
    return s + kg * c.costoUnitario;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (consumoRollos.length === 0) { setError('Selecciona al menos un rollo'); return; }

    for (const cr of consumoRollos) {
      const metros = parseFloat(cr.metrosUsados);
      if (!metros || metros <= 0) { setError(`Metros invalidos para rollo ${cr.codigo}`); return; }
      const kgNecesarios = metros / cr.rinde;
      if (kgNecesarios > cr.pesoActual) {
        setError(`Rollo ${cr.codigo}: ${metros}m requiere ${kgNecesarios.toFixed(2)}kg pero solo tiene ${cr.pesoActual}kg`);
        return;
      }
    }

    setSaving(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/consumo-tela`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumoRollos: consumoRollos.map((c) => ({ rolloId: c.rolloId, metrosUsados: parseFloat(c.metrosUsados) })),
        notas: notas || undefined,
      }),
    });

    if (r.ok) {
      router.push(`/produccion/${ordenId}`);
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Consumo real de tela</h3>
        <p className="text-xs text-stone-400 mb-4">
          Selecciona los rollos usados e indica cuantos metros se consumieron de cada uno.
          El sistema convierte a kg usando el rinde del insumo.
        </p>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rollosDisp.length === 0 ? (
            <p className="text-sm text-stone-400 py-4">No hay rollos con rinde disponibles</p>
          ) : (
            rollosDisp.map((r) => {
              const selected = consumoRollos.find((c) => c.rolloId === r.id);
              const rinde = Number(r.insumo.rinde);
              const metrosDisp = Number(r.pesoActual) * rinde;
              return (
                <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${selected ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
                  <input type="checkbox" checked={!!selected} onChange={() => toggleRollo(r)} className="rounded border-stone-300" />
                  <span className="font-mono text-xs text-stone-700 w-16">{r.codigo}</span>
                  <span className="text-xs text-stone-600 flex-1 truncate">
                    {r.insumo.nombre}{r.color ? ` · ${r.color.nombre}` : ''}
                  </span>
                  <span className="text-xs text-stone-400 tabular-nums">{Number(r.pesoActual).toFixed(1)}kg</span>
                  <span className="text-xs text-stone-400 tabular-nums">~{metrosDisp.toFixed(1)}m</span>
                  {selected && (
                    <div className="flex items-center gap-1">
                      <input type="number" value={selected.metrosUsados}
                        onChange={(e) => updateMetros(r.id, e.target.value)}
                        min="0.01" step="0.01" placeholder="Metros"
                        className={`w-24 ${inpSm}`} />
                      <span className="text-xs text-stone-400">m</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {consumoRollos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Total metros</p>
              <p className="text-stone-800 font-bold tabular-nums">{fmt(totalMetros)} m</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Equivalente kg</p>
              <p className="text-stone-800 tabular-nums">{fmt(totalKg)} kg</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Costo tela</p>
              <p className="text-stone-900 font-bold tabular-nums">${fmt(costoTela)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Notas</h3>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones del consumo, merma, etc." className={`${inp} resize-none`} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving || consumoRollos.length === 0}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition">
          {saving ? 'Registrando...' : 'Registrar consumo de tela'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-4 py-3 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Cancelar
        </button>
      </div>
    </form>
  );
}
