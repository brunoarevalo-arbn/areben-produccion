'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Card } from '@/components/ui/Card';
import { TALLES_DEFAULT } from '@/lib/validators/produccion';

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

type Origen = 'inicial' | 'ajuste' | 'merma' | 'venta';
const ORIGENES: { v: Origen; label: string }[] = [
  { v: 'inicial', label: 'Carga inicial / artículo nuevo' },
  { v: 'ajuste',  label: 'Ajuste / corrección' },
  { v: 'merma',   label: 'Merma' },
  { v: 'venta',   label: 'Venta' },
];

interface Row { sku: string; talle: string; tipo: string; cantidad: number; }
const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Ajuste manual del stock de producto terminado: carga inicial / artículos nuevos o de
// producciones viejas, correcciones, mermas, ventas.
export function AjusteTerminadoForm() {
  const [sku, setSku]         = useState('');
  const [talle, setTalle]     = useState('');
  const [tipo, setTipo]       = useState<'liso' | 'estampado'>('liso');
  const [origen, setOrigen]   = useState<Origen>('inicial');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [rows, setRows]       = useState<Row[]>([]);
  const [openSku, setOpenSku] = useState(false);
  const [otroTalle, setOtroTalle] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/produccion/stock-terminado')
      .then((r) => r.ok ? r.json() : [])
      .then((d: Row[]) => setRows(d))
      .catch(() => {});
  }, []);

  const skus = useMemo(() => [...new Set(rows.map((r) => r.sku))].sort(), [rows]);
  const skuExiste = skus.includes(sku);
  const sugerencias = useMemo(() => {
    const q = norm(sku.trim());
    return skus.filter((s) => !q || norm(s).includes(q)).slice(0, 10);
  }, [skus, sku]);

  // Talles ya existentes para el SKU + tipo elegido (las "variantes disponibles").
  const tallesExistentes = useMemo(
    () => [...new Set(rows.filter((r) => r.sku === sku && r.tipo === tipo).map((r) => r.talle))].sort(),
    [rows, sku, tipo],
  );
  const actual = rows.find((r) => r.sku === sku && r.talle === talle && r.tipo === tipo)?.cantidad ?? 0;

  // Al cambiar SKU o tipo, reseteo el talle (cambian las variantes disponibles).
  useEffect(() => { setTalle(''); setOtroTalle(false); }, [sku, tipo]);

  // Si el SKU tiene variantes y no pedí "otro", elijo entre esas; si no, lista completa.
  const usarExistentes = skuExiste && tallesExistentes.length > 0 && !otroTalle;
  const opcionesNuevoTalle = TALLES_DEFAULT.filter((t) => !tallesExistentes.includes(t));

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
      body: JSON.stringify({ sku, talle, tipo, cantidad: cant, origen, motivo: motivo.trim() || undefined }),
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
    <Card padding="none" className="p-6 max-w-lg">
      <h3 className="text-sm font-bold text-stone-800 mb-1">Cargar / ajustar stock a mano</h3>
      <p className="text-xs text-stone-400 mb-4">Para artículos nuevos o de producciones viejas (que no entraron por el sistema), correcciones, mermas o ventas. Positivo suma, negativo descuenta.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo primero: define qué variantes se muestran */}
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Tipo</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTipo('liso')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold border transition ${tipo === 'liso' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>Liso</button>
            <button type="button" onClick={() => setTipo('estampado')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold border transition ${tipo === 'estampado' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>Estampado</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* SKU: buscador con sugerencias de los ya existentes (permite tipear uno nuevo) */}
          <div className="relative">
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">SKU *</label>
            <input type="text" value={sku} onChange={(e) => { setSku(e.target.value.toUpperCase()); setOpenSku(true); }}
              onFocus={() => setOpenSku(true)}
              onBlur={() => { blurTimer.current = setTimeout(() => setOpenSku(false), 150); }}
              placeholder="Buscar o tipear SKU…" className={`${inp} font-mono`} autoComplete="off" />
            {openSku && sugerencias.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-stone-200 rounded-xl shadow-lg text-sm">
                {sugerencias.map((s) => (
                  <li key={s}>
                    <button type="button"
                      onMouseDown={(e) => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current); setSku(s); setOpenSku(false); }}
                      className="w-full text-left px-3 py-2 font-mono hover:bg-amber-50">{s}</button>
                  </li>
                ))}
              </ul>
            )}
            {sku.trim() && !skuExiste && <p className="text-[11px] text-amber-600 mt-1">SKU nuevo</p>}
          </div>

          {/* Talle: variantes existentes del SKU, o lista completa si es nuevo / "otro" */}
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Talle *</label>
            {usarExistentes ? (
              <select value={otroTalle ? '__otro__' : talle}
                onChange={(e) => { if (e.target.value === '__otro__') { setOtroTalle(true); setTalle(''); } else setTalle(e.target.value); }}
                className={inp}>
                <option value="">-- Talle --</option>
                {tallesExistentes.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="__otro__">＋ Otro talle…</option>
              </select>
            ) : (
              <select value={talle} onChange={(e) => setTalle(e.target.value)} className={inp}>
                <option value="">-- Talle --</option>
                {(skuExiste ? opcionesNuevoTalle : TALLES_DEFAULT).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {otroTalle && <button type="button" onClick={() => { setOtroTalle(false); setTalle(''); }} className="text-[11px] text-stone-500 hover:text-stone-800 mt-1">← variantes existentes</button>}
          </div>
        </div>

        {/* Contexto: stock actual de la variante elegida */}
        {sku.trim() && talle && (
          <p className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">
            Stock actual de <span className="font-mono">{sku}</span> · {talle} · {tipo}: <strong className="text-stone-800 tabular-nums">{actual}</strong>
            {cantidad && parseInt(cantidad) ? <> → quedará <strong className="text-stone-800 tabular-nums">{actual + (parseInt(cantidad) || 0)}</strong></> : null}
          </p>
        )}

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Motivo del movimiento</label>
          <select value={origen} onChange={(e) => setOrigen(e.target.value as Origen)} className={inp}>
            {ORIGENES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad (negativo para descontar) *</label>
          <NumInput value={parseFloat(cantidad) || 0} onChange={(n) => setCantidad(n ? String(n) : '')} placeholder="0" className={inp} />
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nota (opcional)</label>
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Detalle libre, ej: stock viejo depósito" className={inp} />
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}
        {success && <p className="text-emerald-600 text-xs font-semibold">{success}</p>}

        <button type="submit" disabled={saving}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
          {saving ? 'Registrando...' : 'Registrar ajuste'}
        </button>
      </form>
    </Card>
  );
}
