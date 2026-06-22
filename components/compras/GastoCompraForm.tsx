'use client';

import { useState, useEffect } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';

interface OrdenActiva { id: string; sku: string | null; descripcion: string | null; marca: string; }
interface ProveedorOpt { id: string; nombre: string; activo: boolean; }

type Categoria = 'desarrollo' | 'produccion';
type Tipo = 'tela' | 'insumos' | 'periodo';
const TIPOS: Tipo[] = ['tela', 'insumos', 'periodo'];
const MARCAS = ['Zattia', 'Stunned'] as const;
const ESTADOS = ['PENDIENTE', 'PARCIAL', 'PAGADA'] as const;

const inp = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

// Form compartido para "gasto / compra sin stock". Se usa en /compras/nueva y
// en /gastos. Si elegís un proveedor, el gasto es una compra (aparece en Compras).
export function GastoCompraForm({ defaultCategoria = 'desarrollo', onCreado }: {
  defaultCategoria?: Categoria;
  onCreado?: (g: unknown) => void;
}) {
  const [categoria, setCategoria] = useState<Categoria>(defaultCategoria);
  const [tipo, setTipo]           = useState<Tipo>('tela');
  const [marca, setMarca]         = useState<'Zattia' | 'Stunned'>('Zattia');
  const [ordenId, setOrdenId]     = useState('');
  const [sku, setSku]             = useState('');
  const [monto, setMonto]         = useState('');
  const [concepto, setConcepto]   = useState('');
  const [fecha, setFecha]         = useState(new Date().toISOString().slice(0, 10));

  const [proveedorId, setProveedorId]     = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [seguirPago, setSeguirPago]       = useState(false);
  const [estadoPago, setEstadoPago]       = useState<typeof ESTADOS[number]>('PENDIENTE');
  const [montoPagado, setMontoPagado]     = useState('');
  const [fechaPago, setFechaPago]         = useState('');
  const [formaPago, setFormaPago]         = useState('');

  const [proveedores, setProveedores] = useState<ProveedorOpt[]>([]);
  const [ordenes, setOrdenes]         = useState<OrdenActiva[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/proveedores').then((r) => r.ok ? r.json() : []).then((p) => setProveedores(p)).catch(() => {});
    fetch('/api/produccion/cola').then((r) => r.ok ? r.json() : []).then((o) => {
      if (Array.isArray(o)) setOrdenes(o.map((x) => ({ id: x.id, sku: x.sku, descripcion: x.descripcion, marca: x.marca })));
    }).catch(() => {});
  }, []);

  const ordenSel = ordenes.find((o) => o.id === ordenId);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) { setError('Cargá el monto'); return; }

    setSaving(true);
    const body = {
      categoria, tipo,
      marca:   categoria === 'desarrollo' ? marca : (ordenSel?.marca || null),
      sku:     categoria === 'desarrollo' ? (sku.trim() || null) : (ordenSel?.sku || null),
      ordenId: categoria === 'produccion' ? (ordenId || null) : null,
      monto:   montoNum,
      concepto: concepto.trim() || null,
      fecha,
      proveedorId:   proveedorId || null,
      numeroFactura: numeroFactura.trim() || null,
      ...(seguirPago ? {
        estadoPago,
        montoPagado: parseFloat(montoPagado) || 0,
        fechaPago: fechaPago || null,
        formaPago: formaPago.trim() || null,
      } : {}),
    };
    const r = await fetch('/api/gastos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) {
      const g = await r.json();
      onCreado?.(g);
      setSuccess('Registrado correctamente');
      setMonto(''); setConcepto(''); setSku(''); setNumeroFactura(''); setMontoPagado(''); setFechaPago(''); setFormaPago('');
      setTimeout(() => setSuccess(''), 2500);
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const toggle = (active: boolean) => `flex-1 py-2 rounded-lg text-xs font-semibold border transition capitalize ${active ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`;

  return (
    <form onSubmit={guardar} className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3 max-w-lg">
      {/* Categoria */}
      <div className="flex gap-2">
        {(['desarrollo', 'produccion'] as Categoria[]).map((c) => (
          <button key={c} type="button" onClick={() => setCategoria(c)} className={toggle(categoria === c)}>{c}</button>
        ))}
      </div>

      {/* Tipo */}
      <div className="flex gap-2">
        {TIPOS.map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)} className={toggle(tipo === t)}>{t}</button>
        ))}
      </div>

      {/* Marca (desarrollo) u Orden (produccion) */}
      {categoria === 'desarrollo' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex gap-2">
            {MARCAS.map((m) => (
              <button key={m} type="button" onClick={() => setMarca(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${marca === m ? (m === 'Zattia' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-pink-600 border-pink-600 text-white') : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                {m}
              </button>
            ))}
          </div>
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="SKU (opcional)" className={inp} />
        </div>
      ) : (
        <select value={ordenId} onChange={(e) => setOrdenId(e.target.value)} className={inp}>
          <option value="">— Sin orden específica —</option>
          {ordenes.map((o) => <option key={o.id} value={o.id}>{o.sku} · {o.marca}{o.descripcion ? ` — ${o.descripcion}` : ''}</option>)}
        </select>
      )}

      {/* Monto + concepto */}
      <div className="grid grid-cols-2 gap-2">
        <NumInput value={parseFloat(monto) || 0} onChange={(n) => setMonto(n ? String(n) : '')} placeholder="Monto $" className={inp} />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
      </div>
      <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Concepto (opcional)" className={inp} />

      {/* Proveedor + factura (lo que lo convierte en "compra") */}
      <div className="border-t border-stone-200 pt-3 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Compra a proveedor (opcional)</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={inp}>
            <option value="">— Sin proveedor (gasto interno) —</option>
            {proveedores.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input type="text" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="N° factura (opcional)" className={inp} />
        </div>

        {proveedorId && (
          <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
            <input type="checkbox" checked={seguirPago} onChange={(e) => setSeguirPago(e.target.checked)} className="rounded border-stone-300" />
            Seguir el pago (pendiente / parcial / pagada)
          </label>
        )}

        {proveedorId && seguirPago && (
          <div className="grid grid-cols-2 gap-2">
            <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value as typeof ESTADOS[number])} className={inp}>
              {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <NumInput value={parseFloat(montoPagado) || 0} onChange={(n) => setMontoPagado(n ? String(n) : '')} placeholder="Monto pagado $" className={inp} />
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inp} />
            <input type="text" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} placeholder="Forma de pago" className={inp} />
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}
      {success && <p className="text-emerald-600 text-xs font-semibold">{success}</p>}

      <Button type="submit" isLoading={saving} disabled={saving || !monto} className="w-full">
        {proveedorId ? 'Registrar compra' : 'Registrar gasto'}
      </Button>
    </form>
  );
}
