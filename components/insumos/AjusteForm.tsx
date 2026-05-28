'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RolloOpt { id: string; codigo: string; pesoActual: string; insumo: { nombre: string } }
interface LoteOpt  { id: string; codigo: string; cantidadActual: string; insumo: { nombre: string } }
interface MotivoOpt { id: string; nombre: string; categoria: string; activo: boolean; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

export function AjusteForm() {
  const router = useRouter();
  const [tipo, setTipo] = useState<'rollo' | 'lote'>('rollo');
  const [rollos, setRollos] = useState<RolloOpt[]>([]);
  const [lotes, setLotes]   = useState<LoteOpt[]>([]);
  const [motivos, setMotivos] = useState<MotivoOpt[]>([]);
  const [targetId, setTargetId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivoDescarteId, setMotivoDescarteId] = useState('');
  const [motivoExtra, setMotivoExtra] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    fetch('/api/insumos/rollos?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []).then(setRollos);
    fetch('/api/insumos/lotes?estado=DISPONIBLE').then((r) => r.ok ? r.json() : []).then(setLotes);
    fetch('/api/motivos-descarte').then((r) => r.ok ? r.json() : [])
      .then((m: MotivoOpt[]) => setMotivos(m.filter((x) => x.activo)));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!targetId) { setError('Selecciona un rollo o lote'); return; }
    if (!cantidad || Number(cantidad) === 0) { setError('Cantidad no puede ser 0'); return; }
    if (!motivoDescarteId) { setError('Selecciona un motivo'); return; }

    const motivoEntry = motivos.find((m) => m.id === motivoDescarteId);
    const motivoTexto = motivoEntry ? motivoEntry.nombre + (motivoExtra.trim() ? `: ${motivoExtra.trim()}` : '') : motivoExtra.trim();

    if (!motivoTexto) { setError('Detalle obligatorio'); return; }

    setSaving(true);
    const r = await fetch('/api/insumos/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo, targetId, cantidad: Number(cantidad),
        motivo: motivoTexto,
        motivoDescarteId,
      }),
    });

    if (r.ok) {
      setSuccess('Ajuste registrado correctamente');
      setTargetId(''); setCantidad(''); setMotivoDescarteId(''); setMotivoExtra('');
      router.refresh();
    } else {
      const d = await r.json();
      setError(d.error || 'Error al registrar');
    }
    setSaving(false);
  };

  const opciones = tipo === 'rollo' ? rollos : lotes;
  const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Tipo</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setTipo('rollo'); setTargetId(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${tipo === 'rollo' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
              Rollo
            </button>
            <button type="button" onClick={() => { setTipo('lote'); setTargetId(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${tipo === 'lote' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
              Lote
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
            {tipo === 'rollo' ? 'Rollo' : 'Lote'} *
          </label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} required className={inp}>
            <option value="">-- Seleccionar --</option>
            {tipo === 'rollo'
              ? (opciones as RolloOpt[]).map((r) => (
                  <option key={r.id} value={r.id}>{r.codigo} · {r.insumo.nombre} (actual: {fmt(r.pesoActual)})</option>
                ))
              : (opciones as LoteOpt[]).map((l) => (
                  <option key={l.id} value={l.id}>{l.codigo} · {l.insumo.nombre} (actual: {fmt(l.cantidadActual)})</option>
                ))
            }
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad (negativo para descarte) *</label>
          <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
            step="0.01" required className={inp} />
          <p className="text-xs text-stone-400 mt-1">Positivo suma stock, negativo descuenta</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Motivo *</label>
          <select value={motivoDescarteId} onChange={(e) => setMotivoDescarteId(e.target.value)} required className={inp}>
            <option value="">-- Seleccionar motivo --</option>
            {motivos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre} ({m.categoria})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Detalle adicional</label>
          <textarea value={motivoExtra} onChange={(e) => setMotivoExtra(e.target.value)}
            rows={2} placeholder="Opcional: contexto extra del descarte/ajuste..."
            className={`${inp} resize-none`} />
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}
        {success && <p className="text-emerald-600 text-xs font-semibold">{success}</p>}

        <button type="submit" disabled={saving}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          {saving ? 'Registrando...' : 'Registrar ajuste'}
        </button>
      </form>
    </div>
  );
}
