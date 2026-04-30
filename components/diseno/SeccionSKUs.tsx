'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, SKUProyecto } from '@/types/diseno';

const ESTADO_PROD = ['listo', 'en_produccion', 'completado'] as const;
type EstadoProd = typeof ESTADO_PROD[number];
const ESTADO_PROD_LABEL: Record<EstadoProd, string> = {
  listo:         'Listo para producir',
  en_produccion: 'En producción',
  completado:    'Completado',
};
const ESTADO_PROD_BADGE: Record<EstadoProd, string> = {
  listo:         'bg-sky-100 text-sky-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  completado:    'bg-emerald-100 text-emerald-700',
};

const TALLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '34', '36', '38', '40', '42', '44', '46', 'Único'];
const COLORES_SUGERIDOS = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Verde', 'Crema', 'Gris', 'Rosa', 'Beige', 'Otro'];

function SKURow({
  sku,
  proyectoId,
  onRefresh,
}: {
  sku: SKUProyecto;
  proyectoId: string;
  onRefresh: () => void;
}) {
  const [editing,     setEditing]     = useState(false);
  const [form,        setForm]        = useState({ ...sku });
  const [saving,      setSaving]      = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const guardar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyectoId}/skus/${sku.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setSaving(false);
    setEditing(false);
    onRefresh();
  };

  const eliminar = async () => {
    await fetch(`/api/proyectos/${proyectoId}/skus/${sku.id}`, { method: 'DELETE' });
    onRefresh();
  };

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-violet-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Código SKU</label>
            <input type="text" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))} className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Talle</label>
            <select value={form.talle ?? ''} onChange={(e) => setForm((p) => ({ ...p, talle: e.target.value || null }))} className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none">
              <option value="">—</option>
              {TALLES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Color</label>
            <input type="text" value={form.color ?? ''} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value || null }))} list="colores-list" className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" />
            <datalist id="colores-list">{COLORES_SUGERIDOS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Cantidad</label>
            <input type="number" value={form.cantidad} onChange={(e) => setForm((p) => ({ ...p, cantidad: parseInt(e.target.value) || 0 }))} min="0" className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-stone-500 mb-0.5 block">Notas</label>
            <input type="text" value={form.notas ?? ''} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value || null }))} placeholder="Opcional" className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={guardar} disabled={saving} className="bg-stone-900 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-40">{saving ? 'Guardando...' : 'Guardar'}</button>
          <button onClick={() => { setEditing(false); setForm({ ...sku }); }} className="text-xs text-stone-500 px-3 py-2">Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 px-4 py-3 group">
      <div className="font-mono text-sm font-bold text-stone-800 bg-stone-100 px-2.5 py-1 rounded-lg shrink-0">
        {sku.codigo}
      </div>
      <div className="flex gap-2 flex-1 flex-wrap">
        {sku.talle && <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">{sku.talle}</span>}
        {sku.color && <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{sku.color}</span>}
        {sku.notas && <span className="text-xs text-stone-400 italic truncate">{sku.notas}</span>}
      </div>
      <div className="text-right shrink-0">
        <span className="text-sm font-semibold text-stone-700">{sku.cantidad} un.</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
        <button onClick={() => setEditing(true)} className="text-xs text-stone-400 hover:text-violet-600 px-1.5 py-1">Editar</button>
        {confirmando ? (
          <>
            <button onClick={eliminar} className="text-xs text-red-600 font-semibold px-1.5 py-1">Sí</button>
            <button onClick={() => setConfirmando(false)} className="text-xs text-stone-400 px-1.5 py-1">No</button>
          </>
        ) : (
          <button onClick={() => setConfirmando(true)} className="text-xs text-stone-300 hover:text-red-500 px-1.5 py-1">×</button>
        )}
      </div>
    </div>
  );
}

export function SeccionSKUs({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router  = useRouter();
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({ codigo: '', talle: '', color: '', cantidad: 0, notas: '' });

  const ajustesPendientes = proyecto.iteraciones.flatMap((it) => it.ajustes).filter((a) => a.estado === 'pendiente').length;
  const [estadoProd, setEstadoProd] = useState<EstadoProd | ''>((proyecto.estadoProduccion as EstadoProd) ?? '');
  const [cantidad,   setCantidad]   = useState(proyecto.cantidad ?? 0);
  const [savingProd, setSavingProd] = useState(false);
  const [savedProd,  setSavedProd]  = useState(false);

  const guardarProd = async () => {
    setSavingProd(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estadoProduccion: estadoProd || null, cantidad }),
    });
    setSavingProd(false); setSavedProd(true);
    setTimeout(() => setSavedProd(false), 2000);
    router.refresh();
  };

  const pasarAProduccion = async () => {
    setSavingProd(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estadoDiseno: 'produccion', estadoProduccion: 'en_produccion' }),
    });
    setSavingProd(false);
    router.refresh();
  };

  const totalUnidades = proyecto.skus.reduce((acc, s) => acc + s.cantidad, 0);

  const guardar = async () => {
    if (!form.codigo.trim()) return;
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}/skus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo:   form.codigo.trim(),
        talle:    form.talle  || undefined,
        color:    form.color  || undefined,
        cantidad: form.cantidad,
        notas:    form.notas  || undefined,
      }),
    });
    setForm({ codigo: '', talle: '', color: '', cantidad: 0, notas: '' });
    setOpen(false);
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400 mb-0.5">SKUs registrados</p>
          <p className="text-2xl font-bold text-stone-800">{proyecto.skus.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <p className="text-xs text-emerald-500 mb-0.5">Unidades totales</p>
          <p className="text-2xl font-bold text-emerald-700">{totalUnidades}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Gestión de SKUs</p>
        <button onClick={() => setOpen((v) => !v)} className="bg-stone-900 hover:bg-stone-800 text-white text-xs px-4 py-2 rounded-lg font-semibold transition">
          {open ? 'Cancelar' : '+ Nuevo SKU'}
        </button>
      </div>

      {/* Formulario */}
      {open && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Nuevo SKU</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-stone-500 mb-0.5 block">Código SKU *</label>
              <input type="text" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))} placeholder="Ej: ZAT-BLU-M-001" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Talle</label>
              <select value={form.talle} onChange={(e) => setForm((p) => ({ ...p, talle: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-400">
                <option value="">— Seleccionar —</option>
                {TALLES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Color</label>
              <input type="text" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} list="colores-nuevo" placeholder="Ej: Negro" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
              <datalist id="colores-nuevo">{COLORES_SUGERIDOS.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Cantidad</label>
              <input type="number" value={form.cantidad} onChange={(e) => setForm((p) => ({ ...p, cantidad: parseInt(e.target.value) || 0 }))} min="0" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Notas</label>
              <input type="text" value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} placeholder="Opcional" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={guardar} disabled={saving || !form.codigo.trim()} className="bg-stone-900 text-white text-sm px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40">
              {saving ? 'Guardando...' : 'Guardar SKU'}
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-stone-500 px-4 py-2.5">Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {proyecto.skus.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-2xl p-10 text-center">
          <p className="text-stone-400 text-sm">Registrá los SKUs de este diseño con talle y color.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {proyecto.skus.map((sku) => (
            <SKURow key={sku.id} sku={sku} proyectoId={proyecto.id} onRefresh={() => router.refresh()} />
          ))}
        </div>
      )}

      {/* Producción */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Orden de producción</h3>

        {ajustesPendientes > 0 && (
          <p className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
            {ajustesPendientes} ajuste{ajustesPendientes > 1 ? 's' : ''} pendiente{ajustesPendientes > 1 ? 's' : ''} en muestras
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Estado</label>
          <div className="flex gap-2 flex-wrap">
            {ESTADO_PROD.map((est) => (
              <button key={est} type="button" onClick={() => setEstadoProd(est)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                  estadoProd === est
                    ? `${ESTADO_PROD_BADGE[est]} border-transparent`
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
                }`}>
                {ESTADO_PROD_LABEL[est]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5">Cantidad a producir</label>
          <input type="number" value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
            min="0" className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
        </div>

        <div className="flex gap-3">
          <button onClick={guardarProd} disabled={savingProd}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition ${
              savedProd ? 'bg-emerald-600 text-white' : 'bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50'
            }`}>
            {savingProd ? 'Guardando...' : savedProd ? '✓ Guardado' : 'Guardar'}
          </button>
          {proyecto.estadoDiseno !== 'produccion' && (
            <button onClick={pasarAProduccion} disabled={savingProd || ajustesPendientes > 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-40"
              title={ajustesPendientes > 0 ? 'Hay ajustes pendientes' : ''}>
              Pasar a producción →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
