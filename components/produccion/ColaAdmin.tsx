'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParamState, useParamTexto, useParamSet, useVolverA } from '@/lib/hooks/useParamState';
import Link from 'next/link';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CargaTizadaBtn } from '@/components/produccion/CargaTizadaBtn';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { toast } from '@/components/ui/Toaster';
import { LoadingState } from '@/components/ui/LoadingState';
import { PopoverMenu } from '@/components/ui/PopoverMenu';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

interface Transicion { fecha: string; estadoNuevo: string; }

interface Orden {
  id: string;
  sku: string;
  descripcion: string | null;
  marca: string;
  cantidad: number;
  estado: string;
  fichaCorteCargada: boolean;
  costoTotal: string;
  notas: string | null;
  creadoPor: string;
  terminadoAt: string | null;
  createdAt: string;
  cortador: string | null;
  cortadorId: string | null;
  corteEstado: string | null;
  fichaCorteData: { costoCorte?: number; modoCosto?: string } | null;
  transiciones: Transicion[];
  loteId: string | null;
  lote: { id: string; prenda: string | null; descripcion: string | null; marca: string } | null;
}
interface CortadorLite { id: string; nombre: string; activo: boolean; usuarioId: string | null }

interface CatalogoEntry {
  id: string;
  categoria: 'marca' | 'prenda' | 'color';
  nombre: string;
  abreviatura: string;
  activo: boolean;
}

// Estampa y Control de calidad quedan fuera del flujo (la estampa se terceriza).
const ESTADOS = ['PENDIENTE', 'CORTE', 'COSTURA', 'TERMINADO_SIN_ESTAMPA', 'CERRADA'] as const;

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE:             'Pendiente',
  CORTE:                 'Corte',
  COSTURA:               'Costura',
  TERMINADO_SIN_ESTAMPA: 'Listo',
  ESTAMPA:               'Estampa',
  CONTROL_CALIDAD:       'Control calidad',
  CERRADA:               'Cerrada',
};

// Cada estado mantiene su color propio (no se colapsan), para distinguirlos de un vistazo.
const ESTADO_BADGE: Record<string, 'success' | 'warning' | 'default' | 'amber' | 'blue' | 'violet' | 'pink'> = {
  PENDIENTE:             'amber',
  CORTE:                 'blue',
  COSTURA:               'success',
  TERMINADO_SIN_ESTAMPA: 'violet',
  ESTAMPA:               'pink',
  CONTROL_CALIDAD:       'warning',
  CERRADA:               'default',
};

// Flujo: Pendiente → (Corte) → Costura → Listo → Cerrada (archivada).
const ESTADO_SIGUIENTE: Record<string, string[]> = {
  PENDIENTE:             ['CORTE', 'COSTURA'],   // se puede saltar a costura si el corte ya está
  CORTE:                 ['COSTURA'],
  COSTURA:               ['TERMINADO_SIN_ESTAMPA'],
  TERMINADO_SIN_ESTAMPA: ['CERRADA'],            // "Listo" → se cierra y sale de activos
  ESTAMPA:               [],
  CONTROL_CALIDAD:       [],
  CERRADA:               [],
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function diasEnEstado(transiciones: Transicion[]): number {
  if (transiciones.length === 0) return 0;
  const ultima = new Date(transiciones[0].fecha);
  return Math.floor((Date.now() - ultima.getTime()) / 86400000);
}

const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

// Mobile: SKU · Descripción · Cant · Estado · Acciones (Días/Costo ocultos).
// Desktop (md+): se agregan Días y Costo.
const GRID = 'grid grid-cols-[auto_1fr_auto_auto_auto] md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 md:gap-3';

export function ColaAdmin() {
  const [ordenes, setOrdenes]   = useState<Orden[]>([]);
  const [loading, setLoading]   = useState(true);
  // Filtro y búsqueda en la URL: entrar a una OP y volver con Atrás tiene que devolver la
  // cola como estaba, no la vista "Activos" sin buscar.
  const [filtro, setFiltro]     = useParamState<string>('filtro', 'activos');
  const [busqueda, setBusqueda] = useParamTexto('q');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Orden | null>(null);
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editCantidad, setEditCantidad]       = useState('1');
  const [editNotas, setEditNotas]             = useState('');
  const [editSaving, setEditSaving]           = useState(false);
  const [editError, setEditError]             = useState('');

  const [catalogo, setCatalogo]       = useState<CatalogoEntry[]>([]);
  const [cortadores, setCortadores]   = useState<CortadorLite[]>([]);
  const [marcaAbrev, setMarcaAbrev]   = useState('');
  const [prendaAbrev, setPrendaAbrev] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas]             = useState('');
  // Una fila por color: cada una genera una OP (con su SKU) bajo el mismo lote.
  const [variantes, setVariantes]     = useState<{ color: string; cantidad: string }[]>([{ color: '', cantidad: '1' }]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Estado change
  const [cambioId, setCambioId]       = useState<string | null>(null);
  const [cambioNotas, setCambioNotas] = useState('');

  // Mini-modal de SKU (para OPs viejas sin SKU, al mandar a costura)
  const [skuModalOrden, setSkuModalOrden] = useState<Orden | null>(null);
  const [skuPrenda,     setSkuPrenda]     = useState('');
  const [skuColor,      setSkuColor]      = useState('');
  const [skuSaving,     setSkuSaving]     = useState(false);
  const [skuModalError, setSkuModalError] = useState('');

  // Modal terminar costura (conteo por talle → stock de terminados)
  const [terminarOrden,  setTerminarOrden]  = useState<Orden | null>(null);
  const [terminarTalles, setTerminarTalles] = useState<{ talle: string; cantidad: string }[]>([]);
  const [terminarSaving, setTerminarSaving] = useState(false);
  const [terminarError,  setTerminarError]  = useState('');

  // Agrupar OPs sueltas existentes en un lote
  const [agrupando,    setAgrupando]    = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [destinoLote,  setDestinoLote]  = useState(''); // '' = lote nuevo; si no, id de lote existente
  const [agrupSaving,  setAgrupSaving]  = useState(false);

  // Lotes colapsados por defecto; se despliegan con el chevron.
  const [lotesAbiertos, toggleLote] = useParamSet('lotes');

  const volverA = useVolverA();

  const marcas  = catalogo.filter((c) => c.categoria === 'marca' && c.activo);
  const prendas = catalogo.filter((c) => c.categoria === 'prenda' && c.activo);
  const colores = catalogo.filter((c) => c.categoria === 'color' && c.activo);

  // Cuántas OPs tiene cada lote (para permitir agrupar OPs solas en su lote).
  const loteSizes = ordenes.reduce<Record<string, number>>((acc, o) => {
    if (o.loteId) acc[o.loteId] = (acc[o.loteId] ?? 0) + 1;
    return acc;
  }, {});
  // Se puede tildar para agrupar: activa, suelta o SOLA en su lote (no multicolor).
  const esAgrupable = (o: Orden) => agrupando && o.estado !== 'CERRADA' && (!o.loteId || loteSizes[o.loteId] === 1);

  const prendaNombre = (abrev?: string | null) =>
    abrev ? (prendas.find((p) => p.abreviatura === abrev)?.nombre ?? abrev) : null;

  // Lotes existentes (para "agregar a un lote ya creado" como destino del agrupado).
  const lotesExistentes = Object.values(ordenes.reduce<Record<string, { id: string; label: string; count: number }>>((acc, o) => {
    if (o.loteId && o.lote) {
      if (!acc[o.loteId]) acc[o.loteId] = { id: o.loteId, label: `${prendaNombre(o.lote.prenda) || o.lote.descripcion || 'Molde'} · ${o.lote.marca}`, count: 0 };
      acc[o.loteId].count++;
    }
    return acc;
  }, {})).sort((a, b) => a.label.localeCompare(b.label));

  useEffect(() => {
    fetch('/api/sku-catalogo').then((r) => r.ok ? r.json() : []).then(setCatalogo).catch(() => {});
    fetch('/api/cortadores').then((r) => r.ok ? r.json() : []).then((c: CortadorLite[]) => setCortadores(c.filter((x) => x.activo))).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/produccion/cola');
    if (r.ok) setOrdenes(await r.json());
    setLoading(false);
  }, []);

  // Asignar cortador a una OP (desde la cola) o a todo un lote.
  const asignarCortador = async (ordenId: string, cortadorId: string) => {
    const r = await fetch(`/api/produccion/cola/${ordenId}/asignar-cortador`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cortadorId: cortadorId || null }) });
    if (r.ok) { const d = await r.json(); setOrdenes((prev) => prev.map((o) => o.id === ordenId ? { ...o, cortadorId: d.cortadorId, cortador: d.cortador, corteEstado: d.corteEstado } : o)); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo asignar'); }
  };
  // Validar el corte del cortador (cobrable) sin hacer la ficha de tela.
  const validarCorte = async (orden: Orden) => {
    const precio = Number(orden.fichaCorteData?.costoCorte) || 0;
    const total = orden.fichaCorteData?.modoCosto === 'unidad' ? precio * orden.cantidad : precio;
    const unidad = orden.cantidad > 0 ? total / orden.cantidad : total;
    if (!(await confirmAsync({
      title: `Validar corte ${orden.sku ?? 'S/SKU'}`,
      message: `Cantidad: ${orden.cantidad} u\nPrecio: $${fmt(unidad)}/u  ·  Total: $${fmt(total)}\n\nQueda cobrable para el cortador. La ficha de tela se puede hacer después.`,
      confirmLabel: 'Validar',
    }))) return;
    const r = await fetch(`/api/produccion/cola/${orden.id}/validar-corte`, { method: 'POST' });
    if (r.ok) { toast.success('Corte validado — ya es cobrable'); cargar(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo validar'); }
  };
  const asignarCortadorLote = async (loteId: string, cortadorId: string) => {
    const r = await fetch(`/api/produccion/lote/${loteId}/asignar-cortador`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cortadorId: cortadorId || null }) });
    if (r.ok) { toast.success('Cortador asignado al lote'); cargar(); }
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'No se pudo asignar'); }
  };

  useEffect(() => { cargar(); }, [cargar]);

  // --- Form "Nueva producción" (lote madre + una OP por color) ---
  const setVarRow = (i: number, field: 'color' | 'cantidad', val: string) =>
    setVariantes((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  const addVarRow = () => setVariantes((prev) => [...prev, { color: '', cantidad: '1' }]);
  const rmVarRow  = (i: number) => setVariantes((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const resetForm = () => {
    setMarcaAbrev(''); setPrendaAbrev(''); setDescripcion(''); setNotas('');
    setVariantes([{ color: '', cantidad: '1' }]); setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!marcaAbrev || !prendaAbrev) { setError('Elegí marca y prenda'); return; }
    const vs = variantes
      .filter((v) => v.color && (parseInt(v.cantidad) || 0) > 0)
      .map((v) => ({ color: v.color, cantidad: parseInt(v.cantidad) }));
    if (vs.length === 0) { setError('Agregá al menos un color con cantidad'); return; }
    setSaving(true);
    const r = await fetch('/api/produccion/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marca: marcaAbrev, prenda: prendaAbrev, descripcion, notas, variantes: vs }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || 'Error al crear');
    } else {
      cargar();
      resetForm();
      setShowForm(false);
    }
    setSaving(false);
  };

  const cambiarEstado = async (id: string, estado: string) => {
    const ordenT = ordenes.find((o) => o.id === id);
    // Para entrar a costura hace falta SKU; si la OP no lo tiene, pedir prenda+color.
    if (estado === 'COSTURA' && ordenT && !ordenT.sku) {
      setSkuModalOrden(ordenT);
      setSkuPrenda(''); setSkuColor(''); setSkuModalError('');
      return;
    }
    // Terminar costura: pide el conteo por talle (ingresa a stock).
    if (estado === 'TERMINADO_SIN_ESTAMPA' && ordenT?.estado === 'COSTURA') {
      abrirTerminar(ordenT);
      return;
    }
    const esRetroceso = (() => {
      const orden = ordenes.find((o) => o.id === id);
      if (!orden) return false;
      const siguientes = ESTADO_SIGUIENTE[orden.estado] || [];
      return !siguientes.includes(estado);
    })();

    if (esRetroceso && !cambioNotas.trim()) {
      setCambioId(id);
      return;
    }

    const r = await fetch(`/api/produccion/cola/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, notas: cambioNotas || undefined }),
    });
    if (r.ok) {
      cargar();
      setCambioId(null);
      setCambioNotas('');
    } else {
      const d = await r.json();
      toast.error(d.error || 'Error al cambiar estado');
    }
  };

  // Genera/asigna el SKU (prenda+color) y avanza a costura, en un solo paso.
  const asignarSkuYAvanzar = async () => {
    if (!skuModalOrden || !skuPrenda || !skuColor) return;
    setSkuSaving(true);
    setSkuModalError('');
    const r = await fetch(`/api/produccion/cola/${skuModalOrden.id}/sku`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenda: skuPrenda, color: skuColor }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setSkuModalError(d.error || 'Error al generar el SKU');
      setSkuSaving(false);
      return;
    }
    const r2 = await fetch(`/api/produccion/cola/${skuModalOrden.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'COSTURA' }),
    });
    setSkuSaving(false);
    if (r2.ok) {
      setSkuModalOrden(null);
      setSkuPrenda(''); setSkuColor('');
      cargar();
    } else {
      const d = await r2.json().catch(() => ({}));
      setSkuModalError(d.error || 'Error al mandar a costura');
    }
  };

  // Cambio de estado por lote (mandar a costura / cerrar todos los colores elegibles).
  const cambiarEstadoLote = async (loteId: string, estado: 'COSTURA' | 'CERRADA') => {
    const accion = estado === 'COSTURA' ? 'mandar a costura' : 'cerrar';
    if (!(await confirmAsync({ message: `¿Querés ${accion} todos los colores elegibles del lote?`, confirmLabel: estado === 'COSTURA' ? 'A costura' : 'Cerrar', danger: estado === 'CERRADA' }))) return;
    const r = await fetch(`/api/produccion/lote/${loteId}/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.success(`${d.avanzados ?? ''} ${d.avanzados === 1 ? 'color' : 'colores'} ${estado === 'COSTURA' ? 'a costura' : 'cerrados'}`);
      cargar();
    } else {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || 'Error al cambiar estado del lote');
    }
  };

  // Revierte la ficha actual (devuelve el stock) para poder volver a cargarla.
  const revertirFicha = async (id: string) => {
    if (!(await confirmAsync({ message: 'Esto revierte la ficha actual y devuelve el stock consumido, para que la vuelvas a cargar. ¿Continuar?', danger: true, confirmLabel: 'Revertir' }))) return;
    const r = await fetch(`/api/produccion/cola/${id}/corte/revertir`, { method: 'POST' });
    if (r.ok) cargar();
    else { const d = await r.json().catch(() => ({})); toast.error(d.error || 'Error al revertir'); }
  };

  // Terminar costura: prellena el conteo por talle desde la ficha (si está), editable.
  const abrirTerminar = async (orden: Orden) => {
    setTerminarOrden(orden);
    setTerminarError('');
    let talles: { talle: string; cantidad: string }[] = [];
    const r = await fetch(`/api/produccion/cola/${orden.id}/corte`);
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data.cortesPorTalle) && data.cortesPorTalle.length > 0) {
        talles = data.cortesPorTalle.map((c: { talle: string; cantidad: number }) => ({ talle: c.talle, cantidad: String(c.cantidad) }));
      }
    }
    setTerminarTalles(talles.length > 0 ? talles : [{ talle: '', cantidad: '' }]);
  };

  const setTalleRow = (i: number, field: 'talle' | 'cantidad', val: string) =>
    setTerminarTalles((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  const addTalleRow = () => setTerminarTalles((prev) => [...prev, { talle: '', cantidad: '' }]);
  const rmTalleRow  = (i: number) => setTerminarTalles((prev) => prev.filter((_, idx) => idx !== i));
  const totalTerminar = terminarTalles.reduce((s, t) => s + (parseInt(t.cantidad) || 0), 0);

  const confirmarTerminar = async () => {
    if (!terminarOrden) return;
    const talles = terminarTalles
      .filter((t) => t.talle.trim() && (parseInt(t.cantidad) || 0) > 0)
      .map((t) => ({ talle: t.talle.trim().toUpperCase(), cantidad: parseInt(t.cantidad) }));
    if (talles.length === 0) { setTerminarError('Cargá al menos un talle con cantidad'); return; }
    setTerminarSaving(true);
    setTerminarError('');
    const r = await fetch(`/api/produccion/cola/${terminarOrden.id}/terminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talles }),
    });
    setTerminarSaving(false);
    if (r.ok) { setTerminarOrden(null); cargar(); }
    else { const d = await r.json().catch(() => ({})); setTerminarError(d.error || 'Error al terminar'); }
  };

  const eliminar = async (id: string, sku: string | null) => {
    if (!(await confirmAsync({ message: `Eliminar la orden "${sku ?? 'sin SKU'}"?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    const r = await fetch(`/api/produccion/cola/${id}`, { method: 'DELETE' });
    if (r.ok) setOrdenes((prev) => prev.filter((o) => o.id !== id));
  };

  const abrirEdicion = (orden: Orden) => {
    setEditando(orden);
    setEditDescripcion(orden.descripcion ?? '');
    setEditCantidad(String(orden.cantidad));
    setEditNotas(orden.notas ?? '');
    setEditError('');
  };

  const cerrarEdicion = () => { setEditando(null); setEditError(''); };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setEditSaving(true);
    setEditError('');
    const r = await fetch(`/api/produccion/cola/${editando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: editDescripcion, cantidad: editCantidad, notas: editNotas }),
    });
    const data = await r.json();
    if (!r.ok) {
      setEditError(data.error || 'Error al guardar');
    } else {
      setOrdenes((prev) => prev.map((o) => o.id === data.id ? { ...o, ...data } : o));
      setEditando(null);
    }
    setEditSaving(false);
  };

  // --- Agrupar OPs sueltas en un lote ---
  const toggleSel = (id: string) =>
    setSeleccionadas((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const salirAgrupar = () => { setAgrupando(false); setSeleccionadas(new Set()); setDestinoLote(''); };

  const agruparSeleccionadas = async () => {
    const ids = [...seleccionadas];
    const minReq = destinoLote ? 1 : 2;
    if (ids.length < minReq) return;
    const elegidas = ordenes.filter((o) => seleccionadas.has(o.id));
    if (new Set(elegidas.map((o) => o.marca)).size > 1) {
      toast.error('Elegí órdenes de la misma marca');
      return;
    }
    setAgrupSaving(true);
    const r = await fetch('/api/produccion/lote/agrupar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordenIds: ids, loteId: destinoLote || undefined }),
    });
    setAgrupSaving(false);
    if (r.ok) {
      toast.success(`${ids.length} órdenes agrupadas en un lote`);
      salirAgrupar();
      cargar();
    } else {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || 'No se pudo agrupar');
    }
  };

  const q = busqueda.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esCorteListo = (o: Orden) => o.corteEstado === 'cargado' && !o.fichaCorteCargada;
  const filtradas = (
    filtro === 'activos' ? ordenes.filter((o) => o.estado !== 'CERRADA')
    : filtro === 'corte_listo' ? ordenes.filter(esCorteListo)
    : ordenes.filter((o) => o.estado === filtro)
  ).filter((o) => {
    if (!q) return true;
    const hay = `${o.sku ?? ''} ${o.descripcion ?? ''} ${o.marca} ${o.lote?.descripcion ?? ''}`.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return hay.includes(q);
  });

  // Agrupa las órdenes hermanas (mismo lote) para mostrarlas juntas bajo el molde,
  // preservando el orden de aparición. Un lote con una sola orden visible se muestra plano.
  type Fila = { kind: 'lote'; loteId: string; ordenes: Orden[] } | { kind: 'single'; orden: Orden };
  const filas: Fila[] = (() => {
    const byLote = new Map<string, Orden[]>();
    const secuencia: (string | Orden)[] = [];
    for (const o of filtradas) {
      if (o.loteId) {
        if (!byLote.has(o.loteId)) { byLote.set(o.loteId, []); secuencia.push(o.loteId); }
        byLote.get(o.loteId)!.push(o);
      } else {
        secuencia.push(o);
      }
    }
    return secuencia.map((x): Fila => {
      if (typeof x === 'string') {
        const ords = byLote.get(x)!;
        return ords.length >= 2 ? { kind: 'lote', loteId: x, ordenes: ords } : { kind: 'single', orden: ords[0] };
      }
      return { kind: 'single', orden: x };
    });
  })();

  const counts: Record<string, number> = { activos: ordenes.filter((o) => o.estado !== 'CERRADA').length };
  counts.corte_listo = ordenes.filter(esCorteListo).length;
  for (const e of ESTADOS) counts[e] = ordenes.filter((o) => o.estado === e).length;

  const inputClass = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

  const renderOrden = (orden: Orden, dentroDeGrupo = false) => {
    const dias = diasEnEstado(orden.transiciones);
    const siguientes = ESTADO_SIGUIENTE[orden.estado] || [];
    return (
      <div key={orden.id}
        className={`px-4 md:px-5 py-2 ${GRID} items-center hover:bg-stone-50 transition border-t border-stone-100 ${dentroDeGrupo ? 'border-l-2 border-l-amber-200 bg-amber-50/20' : ''} ${orden.estado === 'CERRADA' ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-2">
          {esAgrupable(orden) && (
            <input type="checkbox" checked={seleccionadas.has(orden.id)} onChange={() => toggleSel(orden.id)}
              aria-label={`Seleccionar ${orden.sku ?? orden.id}`} className="rounded border-stone-300 accent-amber-500" />
          )}
          <Link href={`/produccion/${orden.id}?volverA=${encodeURIComponent(volverA)}`}
            className={`font-mono font-bold text-sm px-2 py-0.5 rounded-lg transition ${orden.sku ? 'bg-stone-100 text-stone-700 hover:text-amber-600' : 'bg-amber-50 text-amber-600 hover:text-amber-700'}`}>
            {orden.sku ?? 'S/SKU'}
          </Link>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-stone-800 font-medium truncate">{orden.descripcion || '--'}</p>
            <span className="text-xs text-stone-400 shrink-0">{orden.marca}</span>
            {!orden.sku && <Badge variant="warning" size="sm">SKU pendiente</Badge>}
            {!orden.fichaCorteCargada && orden.estado !== 'CERRADA' && (
              orden.corteEstado === 'validado'
                ? <Badge variant="blue" size="sm">Validado</Badge>
                : orden.corteEstado === 'cargado'
                  ? <Badge variant="success" size="sm">Corte listo</Badge>
                  : <Badge variant="info" size="sm">Ficha pendiente</Badge>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-0.5">{fechaCorta(orden.createdAt)} · {orden.creadoPor}</p>
        </div>
        <span className="text-sm font-bold text-stone-700 text-center tabular-nums">{orden.cantidad}</span>
        <Badge variant={ESTADO_BADGE[orden.estado] ?? 'default'} size="sm" className="whitespace-nowrap justify-self-start">
          {ESTADO_LABEL[orden.estado] ?? orden.estado}
        </Badge>
        <span className={`hidden md:block text-xs tabular-nums text-right ${dias > 3 ? 'text-red-500 font-semibold' : 'text-stone-400'}`}>
          {dias}d
        </span>
        <span className="hidden md:block text-xs tabular-nums text-right text-stone-500">
          {Number(orden.costoTotal) > 0 ? `$${fmt(orden.costoTotal)}` : '--'}
        </span>
        <div className="flex gap-1.5 shrink-0 items-center flex-wrap justify-end">
          {!orden.fichaCorteCargada && orden.estado !== 'CERRADA' && cortadores.length > 0 && (
            <div className="flex items-center gap-1">
              <select value={orden.cortadorId ?? ''} onChange={(e) => asignarCortador(orden.id, e.target.value)} title="Asignar cortador"
                className="text-xs px-1.5 py-1 rounded-lg border border-stone-200 text-stone-600 bg-white cursor-pointer focus:outline-none focus:border-amber-400 max-w-[7.5rem]">
                <option value="">✂ cortador</option>
                {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}
          {!orden.fichaCorteCargada && orden.estado !== 'CERRADA' && orden.corteEstado === 'cargado' && (
            <button onClick={() => validarCorte(orden)} title="Validar el corte (lo hace cobrable, sin ficha de tela)"
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition">
              Validar
            </button>
          )}
          {!orden.fichaCorteCargada && orden.estado !== 'CERRADA' && (
            <CargaTizadaBtn ordenId={orden.id} cortadorId={orden.cortadorId} corteEstado={orden.corteEstado}
              fichaCorteCargada={orden.fichaCorteCargada} onGuardado={cargar} size="sm" />
          )}
          {!orden.fichaCorteCargada && orden.estado !== 'CERRADA' && (
            <Link href={`/produccion/${orden.id}/corte?volverA=${encodeURIComponent(volverA)}`}
              className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition">
              Ficha
            </Link>
          )}
          {orden.fichaCorteCargada && orden.estado !== 'CERRADA' && (
            <button onClick={() => revertirFicha(orden.id)} title="Editar ficha (la revierte para recargarla)"
              className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition">
              ✎ Ficha
            </button>
          )}
          {siguientes.length > 0 && (
            <select
              value=""
              aria-label="Avanzar estado"
              onChange={(e) => { if (e.target.value) cambiarEstado(orden.id, e.target.value); }}
              className="text-xs px-2 py-1 rounded-lg border border-stone-200 text-stone-600 bg-white cursor-pointer focus:outline-none focus:border-amber-400"
            >
              <option value="">Avanzar</option>
              {siguientes.map((s) => (
                <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
              ))}
            </select>
          )}
          <PopoverMenu items={[
            { label: 'Editar orden', onClick: () => abrirEdicion(orden) },
            { label: 'Eliminar', onClick: () => eliminar(orden.id, orden.sku), danger: true },
          ]} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Buscador */}
      <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por SKU, descripción, marca…"
        className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[['activos', 'Activos', counts.activos] as const, ['corte_listo', 'Corte listo', counts.corte_listo] as const, ...ESTADOS.map((e) => [e, ESTADO_LABEL[e], counts[e]] as const)].map(([k, label, n]) => (
          <Button key={k} variant={filtro === k ? 'primary' : 'secondary'} size="sm" onClick={() => setFiltro(k)}>
            {label} <span className="ml-1 opacity-70">{n}</span>
          </Button>
        ))}
        <Button variant={agrupando ? 'primary' : 'ghost'} size="sm" onClick={() => agrupando ? salirAgrupar() : setAgrupando(true)} className="ml-auto">
          {agrupando ? 'Cancelar' : '🧷 Agrupar sueltas'}
        </Button>
        <Button variant="ghost" size="sm" onClick={cargar}>🔄 Actualizar</Button>
      </div>

      {/* Barra de agrupado */}
      {agrupando && (() => {
        const n = seleccionadas.size;
        const minOk = n >= (destinoLote ? 1 : 2);
        return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2.5">
          {/* Paso 1: marcar */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-amber-900">1. Marcá las órdenes a juntar</span>
            <span className="text-xs text-amber-800/70">(mismo molde y marca — solo se pueden marcar las sueltas o las que están solas en su lote)</span>
            <span className="ml-auto text-sm text-amber-900">{n > 0 ? <><strong>{n}</strong> marcada{n === 1 ? '' : 's'}</> : <span className="text-amber-700/70">ninguna marcada</span>}</span>
          </div>
          {/* Paso 2: destino + acción */}
          <div className="flex items-center gap-2 flex-wrap border-t border-amber-200 pt-2.5">
            <span className="text-sm font-semibold text-amber-900">2. ¿Dónde van?</span>
            <select value={destinoLote} onChange={(e) => setDestinoLote(e.target.value)}
              className="px-2 py-1.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-400 max-w-[18rem]">
              <option value="">Crear un lote nuevo</option>
              {lotesExistentes.map((l) => <option key={l.id} value={l.id}>Sumar a: {l.label} ({l.count} color{l.count === 1 ? '' : 'es'})</option>)}
            </select>
            <Button variant="primary" size="sm" onClick={agruparSeleccionadas} isLoading={agrupSaving} disabled={!minOk}>
              {destinoLote ? `Sumar ${n || ''} al lote` : `Crear lote con ${n || ''}`}
            </Button>
            {!minOk && <span className="text-xs text-amber-700">{destinoLote ? 'marcá al menos 1' : 'marcá al menos 2 para un lote nuevo'}</span>}
          </div>
        </div>
        );
      })()}

      {/* Tabla */}
      <Card padding="none" className="overflow-hidden">
        <div className={`px-4 md:px-5 py-2 bg-stone-50 border-b border-stone-100 ${GRID} text-xs font-bold uppercase tracking-widest text-stone-500`}>
          <span>SKU</span>
          <span>Descripcion</span>
          <span className="text-center">Cant.</span>
          <span>Estado</span>
          <span className="hidden md:block text-right">Dias</span>
          <span className="hidden md:block text-right">Costo</span>
          <span />
        </div>

        {loading ? (
          <LoadingState />
        ) : filas.length === 0 ? (
          <EmptyState message="Sin ordenes" />
        ) : (
          filas.map((fila) => {
            if (fila.kind === 'lote') {
              const lote = fila.ordenes[0].lote;
              const totalU = fila.ordenes.reduce((s, o) => s + o.cantidad, 0);
              const hayParaCortar    = fila.ordenes.some((o) => !o.fichaCorteCargada && o.estado !== 'CERRADA');
              const hayParaCostura   = fila.ordenes.some((o) => (ESTADO_SIGUIENTE[o.estado] || []).includes('COSTURA') && o.sku);
              const hayParaTerminar  = fila.ordenes.some((o) => o.estado === 'COSTURA');
              const hayParaCerrar    = fila.ordenes.some((o) => o.estado === 'TERMINADO_SIN_ESTAMPA');
              const asignables       = fila.ordenes.filter((o) => !o.fichaCorteCargada && o.estado !== 'CERRADA');
              const idsCortador      = [...new Set(asignables.map((o) => o.cortadorId))];
              const loteCortadorId   = idsCortador.length === 1 ? (idsCortador[0] ?? '') : '';
              const nCorteListo      = fila.ordenes.filter((o) => !o.fichaCorteCargada && o.corteEstado === 'cargado').length;
              const nValidado        = fila.ordenes.filter((o) => !o.fichaCorteCargada && o.corteEstado === 'validado').length;
              const abierto          = lotesAbiertos.has(fila.loteId) || busqueda.trim() !== '' || agrupando;
              return (
                <div key={fila.loteId} className="border-t border-stone-100">
                  <div className="px-4 md:px-5 py-2 bg-amber-50/60 flex items-center gap-2 text-xs flex-wrap">
                    <button type="button" onClick={() => toggleLote(fila.loteId)}
                      className="flex items-center gap-2 min-w-0 hover:opacity-70 transition" title={abierto ? 'Colapsar lote' : 'Desplegar colores'}>
                      <span className="text-stone-400 w-3 shrink-0">{abierto ? '▾' : '▸'}</span>
                      <span className="text-base">🧵</span>
                      <span className="font-bold text-stone-700">{prendaNombre(lote?.prenda) || lote?.descripcion || 'Molde'}</span>
                      <span className="text-stone-400">{lote?.marca}</span>
                      <Badge variant="amber" size="sm">{fila.ordenes.length} colores</Badge>
                    </button>
                    {lote?.descripcion && prendaNombre(lote?.prenda) && (
                      <span className="text-stone-400 truncate hidden md:inline">· {lote.descripcion}</span>
                    )}
                    {nCorteListo > 0 && <Badge variant="success" size="sm">{nCorteListo} corte listo</Badge>}
                    {nValidado > 0 && <Badge variant="blue" size="sm">{nValidado} validado</Badge>}
                    <span className="ml-auto text-stone-500 font-semibold tabular-nums">{totalU} u</span>
                    {asignables.length > 0 && cortadores.length > 0 && (
                      <select value={loteCortadorId} onChange={(e) => asignarCortadorLote(fila.loteId, e.target.value)} title="Asignar cortador a todo el lote"
                        className="px-1.5 py-1 rounded-lg border border-stone-200 text-stone-600 bg-white cursor-pointer focus:outline-none focus:border-amber-400 max-w-[9rem]">
                        <option value="">✂ cortador (lote)</option>
                        {cortadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    )}
                    {hayParaCortar && (
                      <Link href={`/produccion/lote/${fila.loteId}/corte`}
                        className="px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-semibold">
                        ✂ Cortar lote
                      </Link>
                    )}
                    {hayParaCostura && (
                      <button onClick={() => cambiarEstadoLote(fila.loteId, 'COSTURA')}
                        className="px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition font-semibold">
                        → Costura
                      </button>
                    )}
                    {hayParaTerminar && (
                      <Link href={`/produccion/lote/${fila.loteId}/terminar`}
                        className="px-2.5 py-1 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition font-semibold">
                        ✓ Terminar lote
                      </Link>
                    )}
                    {hayParaCerrar && (
                      <button onClick={() => cambiarEstadoLote(fila.loteId, 'CERRADA')}
                        className="px-2.5 py-1 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 transition font-semibold">
                        Cerrar lote
                      </button>
                    )}
                  </div>
                  {abierto && fila.ordenes.map((orden) => renderOrden(orden, true))}
                </div>
              );
            }
            return renderOrden(fila.orden, false);
          })
        )}
      </Card>

      {/* Boton agregar */}
      {!showForm && (
        <Button variant="primary" size="lg" onClick={() => setShowForm(true)}>
          + Nueva producción
        </Button>
      )}

      {/* Form crear: lote madre + una OP por color */}
      {showForm && (
        <Card padding="none" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-stone-800">Nueva producción</h3>
            <Link href="/produccion/catalogo-sku" className="text-xs text-stone-500 hover:text-stone-800 transition">
              Editar catalogo →
            </Link>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Marca</label>
                <select value={marcaAbrev} onChange={(e) => setMarcaAbrev(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {marcas.map((m) => <option key={m.id} value={m.abreviatura}>{m.nombre} ({m.abreviatura})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Prenda (molde)</label>
                <select value={prendaAbrev} onChange={(e) => setPrendaAbrev(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {prendas.map((p) => <option key={p.id} value={p.abreviatura}>{p.nombre} ({p.abreviatura})</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Colores y cantidades</label>
              <div className="space-y-2">
                {variantes.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={v.color} onChange={(e) => setVarRow(i, 'color', e.target.value)} className={`${inputClass} flex-1`}>
                      <option value="">Color…</option>
                      {colores.map((c) => <option key={c.id} value={c.abreviatura}>{c.nombre} ({c.abreviatura})</option>)}
                    </select>
                    <NumInput value={parseFloat(v.cantidad) || 0} onChange={(n) => setVarRow(i, 'cantidad', n ? String(n) : '')} min="1"
                      className="w-24 px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
                    <span className="font-mono text-[11px] text-stone-400 w-36 truncate hidden sm:block">
                      {marcaAbrev && prendaAbrev && v.color ? `${marcaAbrev}-${prendaAbrev}-${v.color}-•••` : ''}
                    </span>
                    <button type="button" aria-label="Quitar color" onClick={() => rmVarRow(i)} disabled={variantes.length === 1}
                      className="text-stone-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-stone-400 px-1 text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addVarRow} className="text-xs text-amber-600 hover:text-amber-700 font-semibold mt-2">+ Agregar color</button>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Descripción <span className="font-normal text-stone-400">(es lo que ve la costurera en la tablet)</span></label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
                placeholder="Ej: Remera boxy manga corta · se aplica a todos los colores" className={`${inputClass} resize-none`} />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" size="lg" isLoading={saving} className="flex-1">
                {saving ? 'Creando...' : 'Crear producción'}
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Mini-modal: asignar SKU al mandar a costura (OPs viejas sin SKU) */}
      {skuModalOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setSkuModalOrden(null)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-1">Mandar a costura</h3>
            <p className="text-xs text-stone-500 mb-4">
              Generá el SKU para <span className="font-semibold">{skuModalOrden.descripcion || skuModalOrden.marca}</span> (marca: {skuModalOrden.marca}).
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Prenda</label>
                <select value={skuPrenda} onChange={(e) => setSkuPrenda(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {prendas.map((p) => <option key={p.id} value={p.abreviatura}>{p.nombre} ({p.abreviatura})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Color</label>
                <select value={skuColor} onChange={(e) => setSkuColor(e.target.value)} className={inputClass}>
                  <option value="">--</option>
                  {colores.map((c) => <option key={c.id} value={c.abreviatura}>{c.nombre} ({c.abreviatura})</option>)}
                </select>
              </div>
            </div>
            {skuModalError && <p className="text-red-500 text-xs mb-2">{skuModalError}</p>}
            <div className="flex gap-2">
              <Button variant="primary" isLoading={skuSaving} disabled={!skuPrenda || !skuColor} onClick={asignarSkuYAvanzar} className="flex-1">
                {skuSaving ? 'Generando...' : 'Generar SKU y mandar a costura'}
              </Button>
              <Button variant="secondary" onClick={() => setSkuModalOrden(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal terminar costura: conteo por talle → stock de terminados */}
      {terminarOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setTerminarOrden(null)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-1">Terminar costura <span className="font-mono text-stone-500">{terminarOrden.sku}</span></h3>
            <p className="text-xs text-stone-500 mb-3">¿Cuántas salieron de cada talle? Ingresan al stock de terminados.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {terminarTalles.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={t.talle} onChange={(e) => setTalleRow(i, 'talle', e.target.value.toUpperCase())} placeholder="Talle"
                    className="w-24 px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
                  <NumInput value={parseFloat(t.cantidad) || 0} onChange={(n) => setTalleRow(i, 'cantidad', n ? String(n) : '')} placeholder="Cant." min="0"
                    className="flex-1 px-2 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
                  <button type="button" aria-label="Eliminar talle" onClick={() => rmTalleRow(i)} className="text-stone-400 hover:text-red-500 px-1 text-lg leading-none">×</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <button type="button" onClick={addTalleRow} className="text-xs text-stone-500 hover:text-stone-800 transition">+ Agregar talle</button>
              <span className="text-xs text-stone-500">Total: <strong className="text-stone-800">{totalTerminar}</strong> u</span>
            </div>
            {terminarError && <p className="text-red-500 text-xs mt-2">{terminarError}</p>}
            <div className="flex gap-2 mt-4">
              <Button variant="primary" isLoading={terminarSaving} disabled={totalTerminar === 0} onClick={confirmarTerminar} className="flex-1">
                {terminarSaving ? 'Terminando...' : 'Terminar y mandar a stock'}
              </Button>
              <Button variant="secondary" onClick={() => setTerminarOrden(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cambio estado con notas (retroceso) */}
      {cambioId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={() => setCambioId(null)}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800 mb-3">Motivo del cambio</h3>
            <textarea value={cambioNotas} onChange={(e) => setCambioNotas(e.target.value)}
              placeholder="Motivo obligatorio para retroceder..." rows={3}
              className={`${inputClass} resize-none mb-3`} />
            <div className="flex gap-2">
              <Button variant="primary" disabled={!cambioNotas.trim()} className="flex-1"
                onClick={() => { const orden = ordenes.find((o) => o.id === cambioId); if (orden) cambiarEstado(cambioId, orden.estado); }}>
                Confirmar
              </Button>
              <Button variant="secondary" onClick={() => { setCambioId(null); setCambioNotas(''); }}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edicion */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={cerrarEdicion}>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-800">Editar orden</h3>
                <p className="font-mono text-xs text-stone-500 mt-0.5">{editando.sku}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={cerrarEdicion} className="text-stone-400 hover:text-stone-700 text-lg leading-none">x</button>
            </div>
            <form onSubmit={guardarEdicion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Cantidad</label>
                  <NumInput value={parseFloat(editCantidad) || 0} onChange={(n) => setEditCantidad(n ? String(n) : '')} min="1" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Descripcion</label>
                  <input type="text" value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} placeholder="Opcional" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Notas internas</label>
                <textarea value={editNotas} onChange={(e) => setEditNotas(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
              </div>
              {editError && <p className="text-red-500 text-xs">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" size="lg" isLoading={editSaving} className="flex-1">
                  {editSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
                <Button type="button" variant="secondary" size="lg" onClick={cerrarEdicion}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
