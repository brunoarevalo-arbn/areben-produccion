'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';

interface RolloOpt { id: string; codigo: string; pesoActual: string; insumo: { nombre: string } }
interface MotivoOpt { id: string; nombre: string; categoria: string; activo: boolean; }

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

// Ajuste de STOCK de un rollo de tela (sin compra). Los avíos se ajustan en su
// propio catálogo; por eso acá solo hay rollos.
export function AjusteForm() {
  const router = useRouter();
  const [rollos, setRollos] = useState<RolloOpt[]>([]);
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
    fetch('/api/motivos-descarte').then((r) => r.ok ? r.json() : [])
      .then((m: MotivoOpt[]) => setMotivos(m.filter((x) => x.activo)));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!targetId) { setError('Selecciona un rollo'); return; }
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
        tipo: 'rollo', targetId, cantidad: Number(cantidad),
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

  const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Rollo *</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} required className={inp}>
            <option value="">-- Seleccionar --</option>
            {rollos.map((r) => (
              <option key={r.id} value={r.id}>{r.codigo} · {r.insumo.nombre} (actual: {fmt(r.pesoActual)})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad (negativo para descarte) *</label>
          <NumInput value={parseFloat(cantidad) || 0} onChange={(n) => setCantidad(n ? String(n) : '')}
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
