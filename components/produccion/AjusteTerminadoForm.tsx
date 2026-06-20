'use client';

import { useState } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

// Ajuste manual del stock de producto terminado (carga inicial, merma, corrección).
export function AjusteTerminadoForm() {
  const [sku, setSku]         = useState('');
  const [talle, setTalle]     = useState('');
  const [tipo, setTipo]       = useState<'liso' | 'estampado'>('liso');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!sku.trim()) { setError('Cargá el SKU'); return; }
    if (!talle) { setError('Elegí el talle'); return; }
    const cant = parseInt(cantidad);
    if (!cant || cant === 0) { setError('La cantidad no puede ser 0'); return; }

    setSaving(true);
    const r = await fetch('/api/produccion/stock-terminado/ajuste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, talle, tipo, cantidad: cant, motivo: motivo.trim() || undefined }),
    });
    if (r.ok) {
      setSuccess('Ajuste registrado. Actualizando...');
      setTimeout(() => window.location.reload(), 700);
    } else {
      const d = await r.json();
      setError(d.error || 'Error al registrar');
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-lg">
      <h3 className="text-sm font-bold text-stone-800 mb-1">Ajuste manual</h3>
      <p className="text-xs text-stone-400 mb-4">Cargá inventario inicial, corregí o descontá (mermas, ventas). Positivo suma, negativo descuenta.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">SKU *</label>
            <input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="ZATT-TOP-001" className={`${inp} font-mono`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Talle *</label>
            <select value={talle} onChange={(e) => setTalle(e.target.value)} className={inp}>
              <option value="">-- Talle --</option>
              {TALLES_DEFAULT.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Tipo</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTipo('liso')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold border transition ${tipo === 'liso' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
              Liso
            </button>
            <button type="button" onClick={() => setTipo('estampado')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold border transition ${tipo === 'estampado' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>
              Estampado
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad (negativo para descontar) *</label>
          <NumInput value={parseFloat(cantidad) || 0} onChange={(n) => setCantidad(n ? String(n) : '')}
            placeholder="0" className={inp} />
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Motivo</label>
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: inventario inicial, merma, venta..." className={inp} />
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
