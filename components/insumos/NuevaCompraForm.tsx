'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';

interface Proveedor { id: string; nombre: string; }
interface InsumoOpt { id: string; nombre: string; categoria: string; tipoTrazabilidad: string; unidadDefault: string; activo: boolean; }

interface RolloLinea { pesoInicial: string; ubicacion: string; }
interface Linea {
  key: number;
  insumoId: string;
  colorProveedor: string;
  unidad: string;
  cantidad: string;
  precioUnitario: string;
  rollos: RolloLinea[];
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

let keyCounter = 0;

interface InicialCompra {
  id: string;
  proveedorId: string; fecha: string; numeroFactura: string; conIva: boolean;
  totalBruto: string; costoEnvio: string; formaPago: string; estadoPago: string;
  montoPagado: string; fechaPago: string; notas: string;
  lineas: Omit<Linea, 'key'>[];
}

export function NuevaCompraForm({ inicial }: { inicial?: InicialCompra }) {
  const router = useRouter();
  const editando = !!inicial;
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos]         = useState<InsumoOpt[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Cabecera
  const [proveedorId, setProveedorId]     = useState(inicial?.proveedorId ?? '');
  const [fecha, setFecha]                 = useState(inicial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [numeroFactura, setNumeroFactura] = useState(inicial?.numeroFactura ?? '');
  const [conIva, setConIva]               = useState(inicial?.conIva ?? true);
  const [totalBruto, setTotalBruto]       = useState(inicial?.totalBruto ?? '');
  const [costoEnvio, setCostoEnvio]       = useState(inicial?.costoEnvio ?? '');
  const [formaPago, setFormaPago]         = useState(inicial?.formaPago ?? '');
  const [estadoPago, setEstadoPago]       = useState(inicial?.estadoPago ?? 'PENDIENTE');
  const [montoPagado, setMontoPagado]     = useState(inicial?.montoPagado ?? '');
  const [fechaPago, setFechaPago]         = useState(inicial?.fechaPago ?? '');
  const [notas, setNotas]                 = useState(inicial?.notas ?? '');

  // Lineas
  const [lineas, setLineas] = useState<Linea[]>(
    inicial?.lineas?.length
      ? inicial.lineas.map((l) => ({ ...l, key: ++keyCounter }))
      : [{ key: ++keyCounter, insumoId: '', colorProveedor: '', unidad: 'kg', cantidad: '', precioUnitario: '', rollos: [] }],
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/proveedores').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos').then((r) => r.ok ? r.json() : []),
    ]).then(([p, i]) => { setProveedores(p); setInsumos(i); });
  }, []);

  const insumosMap = new Map(insumos.map((i) => [i.id, i]));

  const updateLinea = useCallback((key: number, field: string, value: string) => {
    setLineas((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const updated = { ...l, [field]: value };
      if (field === 'insumoId') {
        const ins = insumosMap.get(value);
        if (ins) {
          updated.unidad = ins.unidadDefault;
          updated.colorProveedor = '';
          if (ins.tipoTrazabilidad === 'rollo' && updated.rollos.length === 0) {
            updated.rollos = [{ pesoInicial: '', ubicacion: '' }];
          } else if (ins.tipoTrazabilidad === 'lote') {
            updated.rollos = [];
          }
        }
      }
      return updated;
    }));
  }, [insumosMap]);

  const addLinea = () => {
    setLineas((prev) => [...prev, { key: ++keyCounter, insumoId: '', colorProveedor: '', unidad: 'kg', cantidad: '', precioUnitario: '', rollos: [] }]);
  };

  const removeLinea = (key: number) => {
    setLineas((prev) => prev.length > 1 ? prev.filter((l) => l.key !== key) : prev);
  };

  const addRollo = (lineaKey: number) => {
    setLineas((prev) => prev.map((l) =>
      l.key === lineaKey ? { ...l, rollos: [...l.rollos, { pesoInicial: '', ubicacion: '' }] } : l
    ));
  };

  const removeRollo = (lineaKey: number, idx: number) => {
    setLineas((prev) => prev.map((l) =>
      l.key === lineaKey ? { ...l, rollos: l.rollos.filter((_, i) => i !== idx) } : l
    ));
  };

  const updateRollo = (lineaKey: number, idx: number, field: string, value: string) => {
    setLineas((prev) => prev.map((l) =>
      l.key === lineaKey ? { ...l, rollos: l.rollos.map((r, i) => i === idx ? { ...r, [field]: value } : r) } : l
    ));
  };

  const subtotalLinea = (l: Linea) => {
    const c = parseFloat(l.cantidad) || 0;
    const p = parseFloat(l.precioUnitario) || 0;
    return c * p;
  };

  const sumaSubtotales = lineas.reduce((s, l) => s + subtotalLinea(l), 0);
  const totalBrutoNum = parseFloat(totalBruto) || 0;
  const totalNetoCalc = conIva ? totalBrutoNum / 1.21 : totalBrutoNum;
  // Tolerancia 0,5% (piso $50): el redondeo de compras en USD no debe trabar.
  const toleranciaDif = Math.max(50, totalNetoCalc * 0.005);
  const diferenciaOk = totalBrutoNum === 0 || Math.abs(sumaSubtotales - totalNetoCalc) < toleranciaDif;

  const sumaRollos = (l: Linea) => l.rollos.reduce((s, r) => s + (parseFloat(r.pesoInicial) || 0), 0);

  const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!proveedorId) { setError('Selecciona un proveedor'); return; }
    if (!totalBruto || totalBrutoNum <= 0) { setError('Total bruto obligatorio'); return; }

    for (const l of lineas) {
      if (!l.insumoId) { setError('Todas las lineas deben tener un insumo'); return; }
      if (!l.cantidad || parseFloat(l.cantidad) <= 0) { setError('Cantidades deben ser positivas'); return; }
      if (!l.precioUnitario || parseFloat(l.precioUnitario) < 0) { setError('Precios invalidos'); return; }

      const ins = insumosMap.get(l.insumoId);
      if (ins?.tipoTrazabilidad === 'rollo') {
        if (l.rollos.length === 0) { setError(`Agrega rollos para "${ins.nombre}"`); return; }
        const sr = sumaRollos(l);
        const cant = parseFloat(l.cantidad) || 0;
        if (Math.abs(sr - cant) > 0.01) {
          setError(`Rollos de "${ins.nombre}": suma ${sr} != cantidad ${cant}`);
          return;
        }
      }
    }

    setSaving(true);

    const payload = {
      proveedorId,
      fecha,
      numeroFactura: numeroFactura || undefined,
      conIva,
      totalBruto: totalBrutoNum,
      costoEnvio: parseFloat(costoEnvio) || 0,
      formaPago: formaPago || undefined,
      estadoPago,
      montoPagado: parseFloat(montoPagado) || 0,
      fechaPago: fechaPago || undefined,
      notas: notas || undefined,
      lineas: lineas.map((l) => ({
        insumoId: l.insumoId,
        colorProveedor: l.colorProveedor || undefined,
        cantidad: parseFloat(l.cantidad),
        unidad: l.unidad,
        precioUnitario: parseFloat(l.precioUnitario),
        rollos: insumosMap.get(l.insumoId)?.tipoTrazabilidad === 'rollo'
          ? l.rollos.map((r) => ({ pesoInicial: parseFloat(r.pesoInicial), ubicacion: r.ubicacion || undefined }))
          : undefined,
      })),
    };

    const r = await fetch(editando ? `/api/compras/${inicial!.id}` : '/api/compras', {
      method: editando ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      if (editando) {
        router.push(`/insumos/compras/${inicial!.id}`);
        router.refresh();
      } else {
        const compra = await r.json();
        router.push(`/insumos/compras/${compra.id}`);
      }
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cabecera */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-stone-800 mb-2">Datos de la compra</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Proveedor *</label>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required className={inp}>
              <option value="">-- Seleccionar --</option>
              {proveedores.filter((p) => 'activo' in p ? p.activo : true).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Nro. factura</label>
            <input type="text" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Ej: A-0099" className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Total bruto *</label>
            <NumInput value={parseFloat(totalBruto) || 0} onChange={(n) => setTotalBruto(n ? String(n) : '')}
              min="0" step="0.01" required className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Envío / flete <span className="text-stone-400 font-normal">(opcional)</span></label>
            <NumInput value={parseFloat(costoEnvio) || 0} onChange={(n) => setCostoEnvio(n ? String(n) : '')}
              min="0" step="0.01" placeholder="0" className={inp} />
          </div>
          <div className="flex items-end gap-3 pb-1">
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)}
                className="rounded border-stone-300" />
              Precios con IVA
            </label>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Forma de pago</label>
            <input type="text" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} placeholder="Transferencia, cheque..." className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Estado de pago</label>
            <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)} className={inp}>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PARCIAL">Parcial</option>
              <option value="PAGADA">Pagada</option>
            </select>
          </div>
          {(estadoPago === 'PARCIAL' || estadoPago === 'PAGADA') && (
            <>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Monto pagado</label>
                <NumInput value={parseFloat(montoPagado) || 0} onChange={(n) => setMontoPagado(n ? String(n) : '')} min="0" step="0.01" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Fecha de pago</label>
                <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inp} />
              </div>
            </>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={`${inp} resize-none`} />
        </div>
        {totalBrutoNum > 0 && (
          <div className="bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-600 flex items-center gap-4">
            <span>Total neto (sin IVA): <strong className="text-stone-800">${fmt(totalNetoCalc)}</strong></span>
          </div>
        )}
      </div>

      {/* Lineas */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800">Lineas de compra</h3>
          <div className="text-xs text-stone-500">
            Suma neto: <span className={`font-bold ${diferenciaOk ? 'text-stone-800' : 'text-red-600'}`}>${fmt(sumaSubtotales)}</span>
            {totalBrutoNum > 0 && !diferenciaOk && <span className="ml-1 text-red-500">(no coincide con total neto ${fmt(totalNetoCalc)})</span>}
          </div>
        </div>

        {lineas.map((l) => {
          const ins = insumosMap.get(l.insumoId);
          const esRollo = ins?.tipoTrazabilidad === 'rollo';
          return (
            <div key={l.key} className="border border-stone-100 rounded-xl p-4 space-y-3">
              {/* Insumo en su propia fila ancha + quitar */}
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Insumo</label>
                  <select value={l.insumoId} onChange={(e) => updateLinea(l.key, 'insumoId', e.target.value)} className={`${inpSm} w-full`}>
                    <option value="">— Elegí un insumo —</option>
                    {insumos.filter((i) => i.activo).map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.categoria})</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => removeLinea(l.key)} title="Quitar línea"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 text-lg leading-none transition">
                  ×
                </button>
              </div>

              {/* Unidad / cantidad / precio / color + subtotal */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-24">
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Unidad</label>
                  <select value={l.unidad} onChange={(e) => updateLinea(l.key, 'unidad', e.target.value)} className={`${inpSm} w-full`}>
                    <option value="kg">kg</option>
                    <option value="metro">metro</option>
                    <option value="unidad">unidad</option>
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Cantidad</label>
                  <NumInput value={parseFloat(l.cantidad) || 0} onChange={(n) => updateLinea(l.key, 'cantidad', n ? String(n) : '')}
                    min="0" step="0.01" className={`${inpSm} w-full`} />
                </div>
                <div className="w-32">
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Precio sin IVA</label>
                  <NumInput value={parseFloat(l.precioUnitario) || 0} onChange={(n) => updateLinea(l.key, 'precioUnitario', n ? String(n) : '')}
                    min="0" step="0.01" className={`${inpSm} w-full`} />
                </div>
                {l.insumoId && (
                  <div className="w-44">
                    <label className="text-xs font-semibold text-stone-600 mb-1 block">Color (proveedor)</label>
                    <input type="text" value={l.colorProveedor}
                      onChange={(e) => updateLinea(l.key, 'colorProveedor', e.target.value)}
                      placeholder="Ej. Lindt — opcional" className={`${inpSm} w-full`} />
                  </div>
                )}
                <div className="ml-auto text-right">
                  <p className="text-xs text-stone-400 mb-1">Subtotal</p>
                  <p className="text-base font-bold text-stone-800 tabular-nums whitespace-nowrap">${fmt(subtotalLinea(l))}</p>
                </div>
              </div>

              {/* Sub-tabla de rollos */}
              {esRollo && l.insumoId && (
                <div className="ml-4 space-y-2">
                  <p className="text-xs text-stone-500 font-semibold">
                    Rollos — suma: {sumaRollos(l).toFixed(2)} / {l.cantidad || '0'}
                    {l.cantidad && Math.abs(sumaRollos(l) - parseFloat(l.cantidad)) > 0.01 && (
                      <span className="text-red-500 ml-1">!!</span>
                    )}
                  </p>
                  {l.rollos.map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2">
                      <span className="text-xs text-stone-400 w-8">#{ri + 1}</span>
                      <NumInput value={parseFloat(r.pesoInicial) || 0} onChange={(n) => updateRollo(l.key, ri, 'pesoInicial', n ? String(n) : '')}
                        placeholder="Peso" step="0.01" min="0" className={`w-28 ${inpSm}`} />
                      <input type="text" value={r.ubicacion} onChange={(e) => updateRollo(l.key, ri, 'ubicacion', e.target.value)}
                        placeholder="Ubicacion" className={`w-32 ${inpSm}`} />
                      <button type="button" onClick={() => removeRollo(l.key, ri)}
                        className="text-red-400 hover:text-red-600 text-sm px-1">x</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addRollo(l.key)}
                    className="text-xs text-stone-500 hover:text-stone-800 transition">
                    + Agregar rollo
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button type="button" onClick={addLinea}
          className="text-xs px-3 py-2 border border-dashed border-stone-300 rounded-xl text-stone-500 hover:text-stone-800 hover:border-stone-400 transition w-full">
          + Agregar linea
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition">
          {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar compra'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-4 py-3 rounded-xl text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition">
          Cancelar
        </button>
      </div>
    </form>
  );
}
