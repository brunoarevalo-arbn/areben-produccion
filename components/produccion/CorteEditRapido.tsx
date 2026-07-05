'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AviosSelector, type AvioOpt, type AvioSel } from '@/components/produccion/AviosSelector';
import { TALLES_DEFAULT, TALLES_COMUNES } from '@/lib/validators/produccion';
import { toast } from '@/components/ui/Toaster';

interface CortadorOpt { id: string; nombre: string; activo: boolean; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

export interface EdicionRapidaInicial {
  cortadorId: string | null;
  costoCorte: number | string;
  modoCosto: 'total' | 'unidad';
  talles: { talle: string; cantidad: number }[];
  avios: { etiquetaId: string; cantidad: number }[];
  fechaCorte?: string | null;
}

const hoyISO = () => new Date().toLocaleDateString('en-CA');

// Edición rápida de la ficha: campos que NO mueven stock (cortador, costo de corte,
// talles, avíos, notas). Guarda directo sin revertir.
export function CorteEditRapido({ ordenId, marca, inicial, onCancel }: {
  ordenId: string; marca: string | null; inicial: EdicionRapidaInicial; onCancel: () => void;
}) {
  const router = useRouter();
  const [cortadores, setCortadores] = useState<CortadorOpt[]>([]);
  const [aviosCatalogo, setAviosCatalogo] = useState<AvioOpt[]>([]);
  const [cortadorId, setCortadorId] = useState(inicial.cortadorId ?? '');
  const [costoCorte, setCostoCorte] = useState(inicial.costoCorte != null ? String(inicial.costoCorte) : '');
  const [modoCosto, setModoCosto] = useState<'total' | 'unidad'>(inicial.modoCosto ?? 'total');
  const [talles, setTalles] = useState<Record<string, string>>(() => Object.fromEntries(inicial.talles.map((t) => [t.talle, String(t.cantidad)])));
  const [aviosSel, setAviosSel] = useState<AvioSel[]>(() => inicial.avios.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: String(a.cantidad) })));
  const [notas, setNotas] = useState('');
  const [fechaCorte, setFechaCorte] = useState<string>(inicial.fechaCorte || hoyISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/cortadores').then((r) => r.ok ? r.json() : []).then((c: CortadorOpt[]) => setCortadores(c.filter((x) => x.activo))).catch(() => {});
    fetch('/api/costos/etiquetas').then((r) => r.ok ? r.json() : []).then((a) => { if (Array.isArray(a)) setAviosCatalogo(a.map((x) => ({ ...x, precio: Number(x.precio) }))); }).catch(() => {});
  }, []);

  const onCortador = (id: string) => setCortadorId(id);

  const [tallesExtra, setTallesExtra] = useState<string[]>([]);
  // Muestra comunes + los que ya tienen cantidad + los agregados a mano; el resto bajo demanda.
  const tallesUnion = [...new Set([...TALLES_COMUNES, ...tallesExtra, ...Object.keys(talles).filter((t) => (parseInt(talles[t]) || 0) > 0)])]
    .sort((a, b) => (TALLES_DEFAULT as readonly string[]).indexOf(a) - (TALLES_DEFAULT as readonly string[]).indexOf(b));
  const tallesAgregables = [...TALLES_DEFAULT].filter((t) => !tallesUnion.includes(t));
  const totalUnidades = Object.values(talles).reduce((s, v) => s + (parseInt(v) || 0), 0);

  const guardar = async () => {
    const tallesArr = Object.entries(talles).map(([talle, v]) => ({ talle, cantidad: parseInt(v) || 0 })).filter((t) => t.cantidad > 0);
    if (tallesArr.length === 0) { toast.error('Cargá al menos un talle'); return; }
    setSaving(true);
    const r = await fetch(`/api/produccion/cola/${ordenId}/corte`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cortadorId: cortadorId || null,
        costoCorte: parseFloat(costoCorte) || 0,
        modoCosto,
        talles: tallesArr,
        avios: aviosSel.map((a) => ({ etiquetaId: a.etiquetaId, cantidad: parseInt(a.cantidad) || 1 })),
        notas: notas.trim() || undefined,
        fechaCorte: fechaCorte || undefined,
      }),
    });
    if (r.ok) { toast.success('Ficha actualizada'); router.push(`/produccion/${ordenId}`); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo guardar'); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-900">
        Edición rápida: no toca la tela ni los rollos. Para cambiar tela/rollos/tizadas usá <strong>Editar ficha (tela)</strong>.
      </div>

      {/* Cortador + fecha + costo */}
      <Card padding="none" className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cortador</label>
          <select value={cortadorId} onChange={(e) => onCortador(e.target.value)} className={inp}>
            <option value="">— Sin cortador —</option>
            {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Fecha de corte</label>
          <input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Costo de corte</label>
          <div className="flex gap-2">
            <NumInput value={parseFloat(costoCorte) || 0} onChange={(n) => setCostoCorte(n ? String(n) : '')} min="0" className={inp} />
            <div className="flex rounded-xl border border-stone-200 overflow-hidden shrink-0">
              {(['total', 'unidad'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setModoCosto(m)} className={`px-3 text-xs font-semibold ${modoCosto === m ? 'bg-stone-900 text-white' : 'bg-white text-stone-500'}`}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Talles */}
      <Card padding="none" className="p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-stone-600">Talles cortados</label>
          <span className="text-xs text-stone-400">Total: <strong className="text-stone-700">{totalUnidades}</strong> u</span>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {tallesUnion.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-stone-500 w-10 text-right">{t}</span>
              <NumInput value={parseFloat(talles[t]) || 0} onChange={(n) => setTalles((p) => ({ ...p, [t]: n ? String(n) : '' }))} min="0" className="w-16 px-2 py-1.5 border border-stone-200 rounded-lg text-sm text-right focus:outline-none focus:border-amber-400" />
            </div>
          ))}
          {tallesAgregables.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) setTallesExtra((p) => [...p, e.target.value]); }}
              className="px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" title="Agregar talle">
              <option value="">+ talle</option>
              {tallesAgregables.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      </Card>

      {/* Avíos */}
      <Card padding="none" className="p-5">
        <label className="text-xs font-semibold text-stone-600 mb-3 block">Avíos</label>
        <AviosSelector aviosCatalogo={aviosCatalogo} marca={marca} aviosSel={aviosSel} setAviosSel={setAviosSel} totalUnidades={totalUnidades} />
      </Card>

      {/* Notas */}
      <Card padding="none" className="p-5">
        <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nota (opcional)</label>
        <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Se agrega a las notas de la orden" className={inp} />
      </Card>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={guardar} isLoading={saving}>Guardar cambios</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
