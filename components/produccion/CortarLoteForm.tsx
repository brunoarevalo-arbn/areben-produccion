'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';
import { calcTizada, type TizadaRollo } from '@/lib/produccion/tizada';
import { AviosSelector, type AvioOpt, type AvioSel } from '@/components/produccion/AviosSelector';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';

interface RolloDisp {
  id: string; codigo: string; pesoActual: string; costoUnitario: string;
  insumo: { nombre: string; rinde: string | null }; color: { nombre: string } | null;
}
interface CortadorOpt { id: string; nombre: string; tarifaDefault: string | null; tarifaModo: string | null; activo: boolean; }
interface OrdenLite { id: string; sku: string | null; descripcion: string | null; cantidad: number; }

// Receta de tizada compartida por todos los colores (mismo molde): nombre + rinde m/u
// derivado de metros/unidades. Los rollos se eligen por color (sección de cada color).
interface RecetaTizada { id: string; nombre: string; metros: string; unidades: string; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

const key = (ordenId: string, tizadaId: string) => `${ordenId}::${tizadaId}`;

export function CortarLoteForm({ loteId, marca, ordenes }: { loteId: string; marca: string | null; ordenes: OrdenLite[] }) {
  const router = useRouter();
  const [rollosDisp, setRollosDisp] = useState<RolloDisp[]>([]);
  const [cortadores, setCortadores] = useState<CortadorOpt[]>([]);
  const [aviosCatalogo, setAviosCatalogo] = useState<AvioOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tizadaSeq = useRef(2);
  const [receta, setReceta] = useState<RecetaTizada[]>([{ id: 't1', nombre: '', metros: '', unidades: '1' }]);

  // Por color: talles y rollos seleccionados por (color, tizada de la receta).
  const [talles, setTalles] = useState<Record<string, Record<string, string>>>({});
  const [rollosSel, setRollosSel] = useState<Record<string, TizadaRollo[]>>({});
  const [filtroTela, setFiltroTela] = useState<Record<string, string>>({});

  // Compartido
  const [aviosSel, setAviosSel] = useState<AvioSel[]>([]);
  const [cortadorId, setCortadorId] = useState('');
  const [costoCorte, setCostoCorte] = useState('');
  const [modoCosto, setModoCosto] = useState<'total' | 'unidad'>('total');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos/rollos?estado=EN_USO_PARCIAL').then((r) => r.ok ? r.json() : []),
      fetch('/api/cortadores').then((r) => r.ok ? r.json() : []),
    ]).then(([r1, r2, ct]) => {
      const allRollos = [...r1, ...r2] as RolloDisp[];
      setRollosDisp(allRollos.filter((r) => r.insumo.rinde && Number(r.insumo.rinde) > 0).sort((a, b) => a.codigo.localeCompare(b.codigo)));
      setCortadores((ct as CortadorOpt[]).filter((c) => c.activo));
    });
    fetch('/api/costos/etiquetas')
      .then((r) => r.ok ? r.json() : [])
      .then((a) => { if (Array.isArray(a)) setAviosCatalogo(a.map((x) => ({ ...x, precio: Number(x.precio) }))); })
      .catch(() => {});
  }, []);

  const onCortadorChange = (id: string) => {
    setCortadorId(id);
    const c = cortadores.find((x) => x.id === id);
    if (c && c.tarifaDefault) {
      setCostoCorte(String(Number(c.tarifaDefault)));
      if (c.tarifaModo === 'total' || c.tarifaModo === 'unidad') setModoCosto(c.tarifaModo);
    }
  };

  // Receta
  const addTizada = () => setReceta((p) => [...p, { id: `t${tizadaSeq.current++}`, nombre: '', metros: '', unidades: '1' }]);
  const removeTizada = (id: string) => setReceta((p) => p.length > 1 ? p.filter((t) => t.id !== id) : p);
  const updTizada = (id: string, field: 'nombre' | 'metros' | 'unidades', val: string) =>
    setReceta((p) => p.map((t) => t.id === id ? { ...t, [field]: val } : t));

  // Talles por color
  const updateTalle = (ordenId: string, talle: string, val: string) =>
    setTalles((p) => ({ ...p, [ordenId]: { ...(p[ordenId] || {}), [talle]: val } }));
  const colorUnidades = (ordenId: string) =>
    Object.values(talles[ordenId] || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);

  // Rollos por color+tizada
  const toggleRollo = (ordenId: string, tizadaId: string, r: RolloDisp) =>
    setRollosSel((prev) => {
      const k = key(ordenId, tizadaId);
      const cur = prev[k] || [];
      const exists = cur.find((c) => c.rolloId === r.id);
      const next = exists ? cur.filter((c) => c.rolloId !== r.id) : [...cur, {
        rolloId: r.id, metros: '', codigo: r.codigo,
        pesoActual: Number(r.pesoActual), costoUnitario: Number(r.costoUnitario),
        rinde: Number(r.insumo.rinde), nombre: `${r.insumo.nombre}${r.color ? ` · ${r.color.nombre}` : ''}`,
      }];
      return { ...prev, [k]: next };
    });

  // Cálculo por color
  const calcColor = (ordenId: string) => {
    const unidades = colorUnidades(ordenId);
    const tizadasCalc = receta.map((t) => ({
      receta: t,
      ...calcTizada({ modo: 'tizada', metros: t.metros, unidades: t.unidades, rollos: rollosSel[key(ordenId, t.id)] || [] }, unidades),
    }));
    // Consumo agregado por rollo (un rollo puede usarse en más de una tizada)
    const agg = new Map<string, { rolloId: string; metrosEf: number; codigo: string; rinde: number; pesoActual: number }>();
    for (const tc of tizadasCalc) {
      for (const c of tc.rollosCalc) {
        const cur = agg.get(c.rolloId);
        if (cur) cur.metrosEf += c.metrosEf;
        else agg.set(c.rolloId, { rolloId: c.rolloId, metrosEf: c.metrosEf, codigo: c.codigo, rinde: c.rinde, pesoActual: c.pesoActual });
      }
    }
    const rollosFinal = [...agg.values()].filter((c) => c.metrosEf > 0.001);
    const costoTela = tizadasCalc.reduce((s, x) => s + x.costo, 0);
    const faltante  = tizadasCalc.reduce((s, x) => s + x.faltante, 0);
    const tieneRollos = receta.some((t) => (rollosSel[key(ordenId, t.id)] || []).length > 0);
    const completo = unidades > 0 && rollosFinal.length > 0 && faltante <= 0.001;
    return { unidades, tizadasCalc, rollosFinal, costoTela, faltante, tieneRollos, completo };
  };

  const colores = ordenes.map((o) => ({ orden: o, calc: calcColor(o.id) }));
  const completos = colores.filter((c) => c.calc.completo);
  const totalUnidades = completos.reduce((s, c) => s + c.calc.unidades, 0);
  const costoTelaTotal = completos.reduce((s, c) => s + c.calc.costoTela, 0);
  const costoCorteInput = parseFloat(costoCorte) || 0;
  const costoCorteTotal = modoCosto === 'unidad' ? costoCorteInput * totalUnidades : costoCorteInput;

  // Reparto del costo de corte (mismo criterio que el backend)
  const splitCorte = (unidades: number) => {
    if (costoCorteTotal <= 0 || totalUnidades === 0) return 0;
    return modoCosto === 'unidad'
      ? costoCorteInput * unidades
      : costoCorteTotal * unidades / totalUnidades;
  };

  const telas = [...new Set(rollosDisp.map((r) => r.insumo.nombre))].sort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones por color "completo"
    for (const { orden, calc } of colores) {
      if (calc.unidades === 0 && !calc.tieneRollos) continue;          // color sin tocar → se salta
      if (calc.unidades === 0) { setError(`${orden.sku ?? 'Color'}: cargá los talles`); return; }
      if (!calc.tieneRollos)  { setError(`${orden.sku ?? 'Color'}: elegí al menos un rollo`); return; }
      if (calc.faltante > 0.001) { setError(`${orden.sku ?? 'Color'}: los rollos no alcanzan, faltan ${fmt(calc.faltante)} m`); return; }
    }

    if (completos.length === 0) { setError('Cargá al menos un color con talles y rollos'); return; }

    setSaving(true);
    const r = await fetch(`/api/produccion/lote/${loteId}/corte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colores: completos.map(({ orden, calc }) => ({
          ordenId: orden.id,
          consumoRollos: calc.rollosFinal.map((c) => ({ rolloId: c.rolloId, metrosUsados: c.metrosEf })),
          cortesPorTalle: Object.entries(talles[orden.id] || {})
            .map(([talle, val]) => ({ talle, cantidad: parseInt(val) || 0 }))
            .filter((t) => t.cantidad > 0),
        })),
        avios: aviosSel.length > 0 ? aviosSel.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: parseInt(a.cantidad) || 1 })) : undefined,
        cortadorId: cortadorId || undefined,
        costoCorte: costoCorteInput > 0 ? costoCorteInput : undefined,
        modoCosto,
        notas: notas || undefined,
      }),
    });

    if (r.ok) {
      router.push('/produccion');
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Receta de tizadas (compartida) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">1. Receta de tizadas <span className="font-normal text-stone-400">(igual para todos los colores)</span></h3>
        <p className="text-xs text-stone-400 mb-4">
          El molde es el mismo, así que la estructura de tizadas y su rinde (m/u) se cargan una vez.
          Los metros de cada color se calculan con el rinde × las unidades de ese color.
        </p>
        {receta.map((t, ti) => {
          const mu = (parseFloat(t.metros) || 0) / (parseInt(t.unidades) || 1);
          return (
            <div key={t.id} className="border border-stone-200 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-stone-400 shrink-0">Tizada {ti + 1}</span>
                <input type="text" value={t.nombre} onChange={(e) => updTizada(t.id, 'nombre', e.target.value)}
                  placeholder="Nombre (ej: Cuerpo, Puño, Manga...)"
                  className="flex-1 text-sm font-semibold bg-transparent border-0 border-b border-stone-200 focus:outline-none focus:border-amber-400 pb-0.5 text-stone-800" />
                {receta.length > 1 && (
                  <button type="button" onClick={() => removeTizada(t.id)} className="text-stone-300 hover:text-red-400 transition text-xl shrink-0 leading-none">×</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Metros de la tizada</label>
                  <NumInput value={parseFloat(t.metros) || 0} onChange={(n) => updTizada(t.id, 'metros', n ? String(n) : '')}
                    min="0" step="0.01" placeholder="Ej: 24.5" className={inpSm + ' w-full'} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Unidades que rinde</label>
                  <NumInput value={parseFloat(t.unidades) || 0} onChange={(n) => updTizada(t.id, 'unidades', n ? String(n) : '')}
                    min="1" step="1" placeholder="Ej: 12" className={inpSm + ' w-full'} />
                </div>
              </div>
              {mu > 0 && <p className="text-xs text-stone-500 mt-2">Rinde: <strong>{fmt(mu)} m/u</strong></p>}
            </div>
          );
        })}
        <button type="button" onClick={addTizada}
          className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition">
          + Agregar tizada
        </button>
      </div>

      {/* 2. Colores: talles + rollos por tizada */}
      {colores.map(({ orden, calc }) => (
        <div key={orden.id} className={`bg-white rounded-2xl border p-6 ${calc.completo ? 'border-blue-200' : 'border-stone-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="font-mono font-bold text-sm px-2 py-1 rounded-lg bg-stone-100 text-stone-700">{orden.sku ?? 'S/SKU'}</span>
            {orden.descripcion && <span className="text-sm text-stone-500 truncate">{orden.descripcion}</span>}
            <span className="ml-auto text-xs text-stone-400">Planificadas: {orden.cantidad}</span>
          </div>

          {/* Talles del color */}
          <label className="text-xs font-semibold text-stone-600 mb-1 block">Desglose por talle</label>
          <div className="grid grid-cols-7 gap-2 mb-3">
            {TALLES_DEFAULT.map((tl) => (
              <div key={tl}>
                <span className="text-xs font-semibold text-stone-500 mb-1 block text-center">{tl}</span>
                <NumInput value={parseFloat(talles[orden.id]?.[tl]) || 0} onChange={(n) => updateTalle(orden.id, tl, n ? String(n) : '')}
                  min="0" placeholder="0" className={`w-full text-center ${inpSm}`} />
              </div>
            ))}
          </div>

          {/* Rollos por cada tizada de la receta */}
          {calc.unidades > 0 ? (
            <div className="space-y-3">
              {receta.map((t) => {
                const k = key(orden.id, t.id);
                const sel = rollosSel[k] || [];
                const tc = calc.tizadasCalc.find((x) => x.receta.id === t.id)!;
                const efMap = new Map(tc.rollosCalc.map((c) => [c.rolloId, c.metrosEf]));
                const lista = filtroTela[k] ? rollosDisp.filter((r) => r.insumo.nombre === filtroTela[k]) : rollosDisp;
                return (
                  <div key={t.id} className="border border-stone-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-stone-600">{t.nombre.trim() || `Tizada ${receta.indexOf(t) + 1}`}</span>
                      <span className="text-xs text-stone-400 tabular-nums">Necesita {fmt(tc.metrosNecesarios)} m</span>
                    </div>
                    {telas.length > 1 && (
                      <select value={filtroTela[k] || ''} onChange={(e) => setFiltroTela((p) => ({ ...p, [k]: e.target.value }))} className={`${inpSm} w-full mb-2`}>
                        <option value="">Todas las telas ({rollosDisp.length} rollos)</option>
                        {telas.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {lista.length === 0 ? (
                        <p className="text-xs text-stone-400 py-1">No hay rollos con rinde disponibles.</p>
                      ) : lista.map((r) => {
                        const selected = sel.find((c) => c.rolloId === r.id);
                        const metrosDisp = Number(r.pesoActual) * Number(r.insumo.rinde);
                        const ef = efMap.get(r.id) ?? 0;
                        return (
                          <div key={r.id} className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border ${selected ? 'border-blue-300 bg-blue-50' : 'border-stone-100'}`}>
                            <input type="checkbox" checked={!!selected} onChange={() => toggleRollo(orden.id, t.id, r)} className="rounded border-stone-300 accent-amber-500" />
                            <span className="font-mono text-xs text-stone-700 w-16">{r.codigo}</span>
                            <span className="text-xs text-stone-600 flex-1 truncate">{r.insumo.nombre}{r.color ? ` · ${r.color.nombre}` : ''}</span>
                            <span className="text-xs text-stone-400 tabular-nums">{Number(r.pesoActual).toFixed(1)}kg · ~{metrosDisp.toFixed(0)}m</span>
                            {selected && (ef > 0.001
                              ? <span className="text-xs font-semibold text-blue-700 tabular-nums w-20 text-right">{fmt(ef)} m</span>
                              : <span className="text-xs text-stone-400 italic w-20 text-right">no usado</span>)}
                          </div>
                        );
                      })}
                    </div>
                    {tc.faltante > 0.001 && (
                      <p className="text-xs text-red-600 mt-2">Los rollos no alcanzan: faltan {fmt(tc.faltante)} m.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-400 italic">Cargá los talles para asignar rollos a este color (o dejalo vacío para cortarlo después).</p>
          )}

          {/* Resumen del color */}
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-4 text-xs">
            <span className="text-stone-500">Unidades: <strong className="text-stone-800">{calc.unidades}</strong></span>
            <span className="text-stone-500">Tela: <strong className="text-stone-800">${fmt(calc.costoTela)}</strong></span>
            {costoCorteTotal > 0 && calc.completo && (
              <span className="text-stone-500">Corte: <strong className="text-stone-800">${fmt(splitCorte(calc.unidades))}</strong></span>
            )}
            <span className="ml-auto">
              {calc.completo
                ? <span className="text-blue-600 font-semibold">Listo para cortar</span>
                : <span className="text-stone-400">Se salta</span>}
            </span>
          </div>
        </div>
      ))}

      {/* 3. Avíos (compartido) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">3. Avíos de la prenda <span className="font-normal text-stone-400">(igual para todos los colores)</span></h3>
        <p className="text-xs text-stone-400 mb-4">El stock se descuenta solo al terminar la producción.</p>
        <AviosSelector aviosCatalogo={aviosCatalogo} marca={marca} aviosSel={aviosSel} setAviosSel={setAviosSel} totalUnidades={totalUnidades} />
      </div>

      {/* 4. Cortador + costo (compartido) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">4. Servicio de corte <span className="font-normal text-stone-400">(un solo servicio para el lote)</span></h3>
        <p className="text-xs text-stone-400 mb-4">El costo se reparte entre los colores según sus unidades.</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cortador</label>
            <select value={cortadorId} onChange={(e) => onCortadorChange(e.target.value)} className={inp}>
              <option value="">-- Seleccionar --</option>
              {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Modo de pago</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModoCosto('total')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoCosto === 'total' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>Total</button>
              <button type="button" onClick={() => setModoCosto('unidad')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${modoCosto === 'unidad' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>Por unidad</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">{modoCosto === 'unidad' ? 'Costo por unidad' : 'Costo total del corte'}</label>
            <NumInput value={parseFloat(costoCorte) || 0} onChange={(n) => setCostoCorte(n ? String(n) : '')} min="0" step="0.01" placeholder="0" className={inp} />
            {modoCosto === 'unidad' && costoCorteInput > 0 && totalUnidades > 0 && (
              <p className="text-xs text-stone-500 mt-1">${fmt(costoCorteInput)}/u × {totalUnidades} = <strong>${fmt(costoCorteTotal)}</strong></p>
            )}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-3">Notas</h3>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones del corte (se agregan a cada color)." className={`${inp} resize-none`} />
      </div>

      {/* Resumen */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Colores</p><p className="text-stone-900 font-bold text-lg">{completos.length} / {ordenes.length}</p></div>
          <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Tela</p><p className="text-stone-800 tabular-nums">${fmt(costoTelaTotal)}</p></div>
          <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Corte</p><p className="text-stone-800 tabular-nums">${fmt(costoCorteTotal)}</p></div>
          <div><p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-1">Unidades</p><p className="text-stone-900 font-bold text-lg">{totalUnidades}</p></div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="lg" isLoading={saving} disabled={completos.length === 0}>
          {saving ? 'Registrando...' : `Cortar ${completos.length} ${completos.length === 1 ? 'color' : 'colores'}`}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  );
}
