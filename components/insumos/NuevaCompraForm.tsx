'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

interface Proveedor { id: string; nombre: string; }
interface InsumoOpt { id: string; nombre: string; categoria: string; tipoTrazabilidad: string; unidadDefault: string; activo: boolean; }
interface ColorOpt { id: string; nombre: string; categoria: string; activo: boolean; }

interface RolloLinea { pesoInicial: string; ubicacion: string; }
interface Linea {
  key: number;
  insumoId: string;
  colorId: string;
  colorProveedor: string;
  unidad: string;
  cantidad: string;
  precioUnitario: string;
  rollos: RolloLinea[];
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';
const inpSm = 'px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400';

let keyCounter = 0;

// Normaliza para matchear nombres (minúsculas, sin acentos ni espacios extra).
const normalizar = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

interface InicialCompra {
  id: string;
  proveedorId: string; fecha: string; numeroFactura: string; conIva: boolean;
  totalBruto: string; costoEnvio: string; fleteModo?: string; fletePorcentaje?: string;
  formaPago: string; estadoPago: string;
  montoPagado: string; fechaPago: string; notas: string;
  lineas: Omit<Linea, 'key'>[];
}

export function NuevaCompraForm({ inicial }: { inicial?: InicialCompra }) {
  const router = useRouter();
  const editando = !!inicial;
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos]         = useState<InsumoOpt[]>([]);
  const [colores, setColores]         = useState<ColorOpt[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Cabecera
  const [proveedorId, setProveedorId]     = useState(inicial?.proveedorId ?? '');
  const [fecha, setFecha]                 = useState(inicial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [numeroFactura, setNumeroFactura] = useState(inicial?.numeroFactura ?? '');
  const [conIva, setConIva]               = useState(inicial?.conIva ?? true);
  const [totalBruto, setTotalBruto]       = useState(inicial?.totalBruto ?? '');
  const [fleteModo, setFleteModo]         = useState<'monto' | 'porcentaje'>(inicial?.fleteModo === 'porcentaje' ? 'porcentaje' : 'monto');
  // Guarda el número crudo del flete (pesos si modo monto, % si modo porcentaje).
  const [costoEnvio, setCostoEnvio]       = useState(
    inicial?.fleteModo === 'porcentaje' ? (inicial?.fletePorcentaje ?? '') : (inicial?.costoEnvio ?? ''));
  const [formaPago, setFormaPago]         = useState(inicial?.formaPago ?? '');
  const [estadoPago, setEstadoPago]       = useState(inicial?.estadoPago ?? 'PENDIENTE');
  const [montoPagado, setMontoPagado]     = useState(inicial?.montoPagado ?? '');
  const [fechaPago, setFechaPago]         = useState(inicial?.fechaPago ?? '');
  const [notas, setNotas]                 = useState(inicial?.notas ?? '');

  // Importar desde factura (pegando el JSON que devuelve claude.ai — sin costo)
  const [importOpen, setImportOpen]   = useState(false);
  const [importText, setImportText]   = useState('');
  const [importMsg, setImportMsg]     = useState<{ ok: boolean; texto: string } | null>(null);
  const [promptCopiado, setPromptCopiado] = useState(false);

  // Lineas
  const [lineas, setLineas] = useState<Linea[]>(
    inicial?.lineas?.length
      ? inicial.lineas.map((l) => ({ ...l, key: ++keyCounter }))
      : [{ key: ++keyCounter, insumoId: '', colorId: '', colorProveedor: '', unidad: 'kg', cantidad: '', precioUnitario: '', rollos: [] }],
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/proveedores').then((r) => r.ok ? r.json() : []),
      fetch('/api/insumos').then((r) => r.ok ? r.json() : []),
      fetch('/api/sku-catalogo').then((r) => r.ok ? r.json() : []),
    ]).then(([p, i, c]) => {
      setProveedores(p); setInsumos(i);
      setColores((Array.isArray(c) ? c : []).filter((x: ColorOpt) => x.categoria === 'color' && x.activo));
    });
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
          updated.colorId = '';
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
    setLineas((prev) => [...prev, { key: ++keyCounter, insumoId: '', colorId: '', colorProveedor: '', unidad: 'kg', cantidad: '', precioUnitario: '', rollos: [] }]);
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

  // --- Importar desde factura ---------------------------------------------
  // Prompt listo para pegar en claude.ai junto a la foto/PDF de la factura.
  // Embebe los nombres de tus telas y proveedores para que matchee exacto.
  const construirPrompt = () => {
    const telas = insumos.filter((i) => i.activo).map((i) => `- ${i.nombre}`).join('\n') || '- (sin telas cargadas)';
    const provs = proveedores.map((p) => `- ${p.nombre}`).join('\n') || '- (sin proveedores)';
    return `Sos un asistente que extrae los datos de una factura de compra de telas.
Te voy a pasar la foto o el PDF de una factura. Devolveme SOLO un bloque JSON (sin texto antes ni después) con esta forma exacta:

{
  "proveedor": "<el más parecido de la lista de proveedores>",
  "fecha": "AAAA-MM-DD",
  "numeroFactura": "<nro de factura, o vacío>",
  "preciosConIva": true,
  "totalBruto": <número: el total de la factura tal cual figura>,
  "lineas": [
    {
      "descripcion": "<usá EXACTAMENTE uno de los nombres de la lista de telas>",
      "cantidad": <número>,
      "unidad": "kg" | "metro" | "unidad",
      "precioUnitario": <número: precio por unidad tal cual figura>,
      "color": "<color del proveedor si aparece, o vacío>"
    }
  ]
}

Reglas:
- "descripcion": elegí el nombre MÁS PARECIDO de esta lista de telas (no inventes nombres nuevos):
${telas}
- "proveedor": elegí el más parecido de esta lista:
${provs}
- "preciosConIva": true si los precios de la factura incluyen IVA, false si están sin IVA.
- Números sin símbolos de moneda ni separadores de miles. Usá punto como decimal (ej: 1234.50).
- Si un dato no aparece en la factura, dejalo vacío ("" o 0).
- No agregues comentarios ni explicaciones: solo el JSON.`;
  };

  const copiarPrompt = async () => {
    try {
      await navigator.clipboard.writeText(construirPrompt());
      setPromptCopiado(true);
      setTimeout(() => setPromptCopiado(false), 2500);
    } catch {
      setImportMsg({ ok: false, texto: 'No se pudo copiar. Seleccioná y copiá el prompt manualmente.' });
    }
  };

  // Busca el insumo que mejor matchea una descripción de la factura.
  const matchInsumo = (descripcion: string): InsumoOpt | null => {
    const n = normalizar(descripcion);
    if (!n) return null;
    const activos = insumos.filter((i) => i.activo);
    return (
      activos.find((i) => normalizar(i.nombre) === n) ||
      activos.find((i) => normalizar(i.nombre).includes(n) || n.includes(normalizar(i.nombre))) ||
      null
    );
  };

  const cargarImport = () => {
    setImportMsg(null);
    let raw = importText.trim();
    if (!raw) { setImportMsg({ ok: false, texto: 'Pegá primero el JSON que te devolvió Claude.' }); return; }
    // Tolera que Claude lo envuelva en ```json ... ```
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    // O que venga con texto alrededor: tomar del primer { al último }.
    const ini = raw.indexOf('{'), fin = raw.lastIndexOf('}');
    if (ini > 0 || fin < raw.length - 1) raw = raw.slice(ini, fin + 1);

    let data: {
      proveedor?: string; fecha?: string; numeroFactura?: string;
      preciosConIva?: boolean; totalBruto?: number;
      lineas?: { descripcion?: string; cantidad?: number; unidad?: string; precioUnitario?: number; color?: string }[];
    };
    try {
      data = JSON.parse(raw);
    } catch {
      setImportMsg({ ok: false, texto: 'El texto pegado no es un JSON válido. Pegá el bloque completo (con sus llaves { }).' });
      return;
    }

    const conIvaImp = data.preciosConIva !== false; // default: con IVA

    // Cabecera
    if (data.proveedor) {
      const prov = proveedores.find((p) => normalizar(p.nombre) === normalizar(data.proveedor!))
        || proveedores.find((p) => normalizar(p.nombre).includes(normalizar(data.proveedor!)));
      if (prov) setProveedorId(prov.id);
    }
    if (data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) setFecha(data.fecha);
    if (data.numeroFactura) setNumeroFactura(String(data.numeroFactura));
    setConIva(conIvaImp);
    if (data.totalBruto && Number(data.totalBruto) > 0) setTotalBruto(String(Number(data.totalBruto)));

    // Líneas
    const filas = Array.isArray(data.lineas) ? data.lineas : [];
    let matcheados = 0;
    const nuevas: Linea[] = filas.map((f) => {
      const ins = matchInsumo(f.descripcion || '');
      if (ins) matcheados++;
      const cant = Number(f.cantidad) || 0;
      // El form pide precio SIN IVA por línea; si la factura es con IVA, lo paso a neto.
      const precioBruto = Number(f.precioUnitario) || 0;
      const precio = conIvaImp ? precioBruto / 1.21 : precioBruto;
      const unidad = ins?.unidadDefault || (['kg', 'metro', 'unidad'].includes(f.unidad || '') ? f.unidad! : 'kg');
      const esRollo = ins?.tipoTrazabilidad === 'rollo';
      return {
        key: ++keyCounter,
        insumoId: ins?.id || '',
        colorId: '',
        colorProveedor: f.color || '',
        unidad,
        cantidad: cant ? String(cant) : '',
        precioUnitario: precio ? String(Number(precio.toFixed(4))) : '',
        // Por defecto 1 rollo = la cantidad total (se puede dividir después).
        rollos: esRollo ? [{ pesoInicial: cant ? String(cant) : '', ubicacion: '' }] : [],
      };
    });

    if (nuevas.length === 0) {
      setImportMsg({ ok: false, texto: 'El JSON no trae renglones ("lineas"). Revisá lo que pegaste.' });
      return;
    }

    setLineas(nuevas);
    const sinMatch = nuevas.length - matcheados;
    setImportMsg({
      ok: true,
      texto: `Cargado: ${nuevas.length} renglón(es), ${matcheados} matcheado(s) con tus telas`
        + (sinMatch > 0 ? ` · ${sinMatch} sin tela asignada — elegila en el selector de cada renglón.` : '.')
        + (conIvaImp ? ' Precios convertidos a netos (sin IVA).' : ''),
    });
    setImportOpen(false);
  };

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
      costoEnvio: fleteModo === 'monto' ? (parseFloat(costoEnvio) || 0) : 0,
      fleteModo,
      fletePorcentaje: fleteModo === 'porcentaje' ? (parseFloat(costoEnvio) || 0) : undefined,
      formaPago: formaPago || undefined,
      estadoPago,
      montoPagado: parseFloat(montoPagado) || 0,
      fechaPago: fechaPago || undefined,
      notas: notas || undefined,
      lineas: lineas.map((l) => ({
        insumoId: l.insumoId,
        colorId: l.colorId || undefined,
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
        router.push(`/inventario/compras/${inicial!.id}`);
        router.refresh();
      } else {
        const compra = await r.json();
        router.push(`/inventario/compras/${compra.id}`);
      }
    } else {
      const d = await r.json();
      setError(d.error || 'Error al guardar');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Importar desde factura (vía claude.ai, sin costo) */}
      {!editando && (
        <div className="bg-amber-50/60 rounded-2xl border border-amber-200 p-5">
          <button type="button" onClick={() => setImportOpen((o) => !o)}
            className="w-full flex items-center justify-between text-left">
            <span className="text-sm font-bold text-amber-900 flex items-center gap-2">
              📋 Importar desde factura
              <span className="text-xs font-normal text-amber-700/80">(pegá lo que te da claude.ai — sin costo)</span>
            </span>
            <span className="text-amber-700 text-lg leading-none">{importOpen ? '−' : '+'}</span>
          </button>

          {importOpen && (
            <div className="mt-4 space-y-3">
              <ol className="text-xs text-amber-900/80 space-y-1 list-decimal list-inside">
                <li>Copiá el prompt y pegalo en <strong>claude.ai</strong> junto a la foto o PDF de la factura.</li>
                <li>Claude te devuelve un bloque JSON. Copialo y pegalo en el cuadro de abajo.</li>
                <li>Tocá <strong>Cargar en el formulario</strong>, revisá los renglones y registrá la compra.</li>
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={copiarPrompt}>
                  {promptCopiado ? '✓ Prompt copiado' : 'Copiar prompt para claude.ai'}
                </Button>
              </div>

              <Textarea
                label="Pegá acá el JSON de la factura"
                fullWidth
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder={'{\n  "proveedor": "...",\n  "totalBruto": 150000,\n  "lineas": [ ... ]\n}'}
                className="resize-none font-mono text-xs"
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" onClick={cargarImport}>Cargar en el formulario</Button>
                {importText && (
                  <button type="button" onClick={() => { setImportText(''); setImportMsg(null); }}
                    className="text-xs text-stone-500 hover:text-stone-800 transition">Limpiar</button>
                )}
              </div>
            </div>
          )}

          {importMsg && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-xs ${importMsg.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {importMsg.texto}
            </div>
          )}
        </div>
      )}

      {/* Cabecera */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-stone-800 mb-2">Datos de la compra</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Select label="Proveedor *" fullWidth value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
            <option value="">-- Seleccionar --</option>
            {proveedores.filter((p) => 'activo' in p ? p.activo : true).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Input label="Fecha *" fullWidth type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          <Input label="Nro. factura" fullWidth type="text" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Ej: A-0099" />
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Total bruto *</label>
            <NumInput value={parseFloat(totalBruto) || 0} onChange={(n) => setTotalBruto(n ? String(n) : '')}
              min="0" step="0.01" required className={inp} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Envío / flete <span className="text-stone-400 font-normal">(opcional)</span></label>
            <div className="flex gap-2">
              <select value={fleteModo} onChange={(e) => setFleteModo(e.target.value as 'monto' | 'porcentaje')}
                className="w-28 px-2 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400">
                <option value="monto">$ pesos</option>
                <option value="porcentaje">%</option>
              </select>
              <NumInput value={parseFloat(costoEnvio) || 0} onChange={(n) => setCostoEnvio(n ? String(n) : '')}
                min="0" step="0.01" placeholder={fleteModo === 'porcentaje' ? '% sobre la compra' : '0'} className={inp} />
            </div>
            {fleteModo === 'porcentaje' && (parseFloat(costoEnvio) || 0) > 0 && sumaSubtotales > 0 && (
              <p className="text-xs text-stone-400 mt-1">≈ ${fmt(sumaSubtotales * (parseFloat(costoEnvio) || 0) / 100)} sobre ${fmt(sumaSubtotales)} neto</p>
            )}
          </div>
          <div className="flex items-end gap-3 pb-1">
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)}
                className="rounded border-stone-300 accent-amber-500" />
              Precios con IVA
            </label>
          </div>
          <Input label="Forma de pago" fullWidth type="text" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} placeholder="Transferencia, cheque..." />
          <Select label="Estado de pago" fullWidth value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)}>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PAGADA">Pagada</option>
          </Select>
          {(estadoPago === 'PARCIAL' || estadoPago === 'PAGADA') && (
            <>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Monto pagado</label>
                <NumInput value={parseFloat(montoPagado) || 0} onChange={(n) => setMontoPagado(n ? String(n) : '')} min="0" step="0.01" className={inp} />
              </div>
              <Input label="Fecha de pago" fullWidth type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </>
          )}
        </div>
        <Textarea label="Notas" fullWidth value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="resize-none" />
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
                  <div className="w-40">
                    <label className="text-xs font-semibold text-stone-600 mb-1 block">Color interno</label>
                    <select value={l.colorId} onChange={(e) => updateLinea(l.key, 'colorId', e.target.value)} className={`${inpSm} w-full`}>
                      <option value="">— sin asignar —</option>
                      {colores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}
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
        <Button type="submit" size="lg" isLoading={saving}>
          {editando ? 'Guardar cambios' : 'Registrar compra'}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
