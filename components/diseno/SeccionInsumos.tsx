'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, ProyectoInsumo } from '@/types/diseno';

const TIPOS_INSUMO = ['tela', 'avío', 'hilo', 'bordado', 'estampado', 'etiqueta', 'otro'];
const UNIDADES     = ['m', 'kg', 'g', 'cm', 'unid', 'mt', 'L', 'rollo'];

function InsumoRow({
  insumo,
  proyectoId,
  onRefresh,
}: {
  insumo: ProyectoInsumo;
  proyectoId: string;
  onRefresh: () => void;
}) {
  const [editing,    setEditing]    = useState(false);
  const [form,       setForm]       = useState({ ...insumo });
  const [saving,     setSaving]     = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const guardar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyectoId}/insumos/${insumo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setEditing(false);
    onRefresh();
  };

  const eliminar = async () => {
    await fetch(`/api/proyectos/${proyectoId}/insumos/${insumo.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const costoTotal = insumo.cantidad * insumo.costoUnitario;

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-violet-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-stone-500 mb-0.5 block">Nombre</label>
            <input type="text" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Tipo</label>
            <select value={form.tipo ?? ''} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value || null }))} className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none">
              <option value="">—</option>
              {TIPOS_INSUMO.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Proveedor</label>
            <input type="text" value={form.proveedor ?? ''} onChange={(e) => setForm((p) => ({ ...p, proveedor: e.target.value || null }))} className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Cantidad</label>
            <div className="flex gap-1">
              <input type="number" value={form.cantidad} onChange={(e) => setForm((p) => ({ ...p, cantidad: parseFloat(e.target.value) || 0 }))} min="0" step="0.1" className="w-24 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" />
              <select value={form.unidad} onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))} className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                {UNIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-0.5 block">Costo unitario ($)</label>
            <input type="number" value={form.costoUnitario} onChange={(e) => setForm((p) => ({ ...p, costoUnitario: parseFloat(e.target.value) || 0 }))} min="0" step="0.01" className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-stone-500 mb-0.5 block">Notas</label>
            <input type="text" value={form.notas ?? ''} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value || null }))} className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400" placeholder="Opcional..." />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={guardar} disabled={saving} className="bg-stone-900 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-40">{saving ? 'Guardando...' : 'Guardar'}</button>
          <button onClick={() => { setEditing(false); setForm({ ...insumo }); }} className="text-xs text-stone-500 px-3 py-2">Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 px-4 py-3 group">
      {insumo.tipo && (
        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium shrink-0">{insumo.tipo}</span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">{insumo.nombre}</p>
        {insumo.proveedor && <p className="text-xs text-stone-400 truncate">{insumo.proveedor}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-stone-700">{insumo.cantidad} {insumo.unidad}</p>
        {insumo.costoUnitario > 0 && (
          <p className="text-xs text-stone-400">${insumo.costoUnitario}/u · <span className="font-medium text-stone-600">${costoTotal.toFixed(0)} total</span></p>
        )}
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

export function SeccionInsumos({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router  = useRouter();
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({
    nombre: '', tipo: '', proveedor: '', unidad: 'm', cantidad: 1, costoUnitario: 0, notas: '',
  });

  const costoTotalProyecto = proyecto.insumos.reduce(
    (acc, ins) => acc + ins.cantidad * ins.costoUnitario, 0
  );

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}/insumos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre:        form.nombre.trim(),
        tipo:          form.tipo        || undefined,
        proveedor:     form.proveedor   || undefined,
        unidad:        form.unidad,
        cantidad:      form.cantidad,
        costoUnitario: form.costoUnitario,
        notas:         form.notas       || undefined,
      }),
    });
    setForm({ nombre: '', tipo: '', proveedor: '', unidad: 'm', cantidad: 1, costoUnitario: 0, notas: '' });
    setOpen(false);
    setSaving(false);
    router.refresh();
  };

  const porTipo = TIPOS_INSUMO.reduce<Record<string, ProyectoInsumo[]>>((acc, tipo) => {
    acc[tipo] = proyecto.insumos.filter((i) => i.tipo === tipo);
    return acc;
  }, {});
  const sinTipo = proyecto.insumos.filter((i) => !i.tipo || i.tipo === 'otro');

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400 mb-0.5">Insumos cargados</p>
          <p className="text-2xl font-bold text-stone-800">{proyecto.insumos.length}</p>
        </div>
        <div className="bg-violet-50 rounded-xl border border-violet-100 p-4">
          <p className="text-xs text-violet-500 mb-0.5">Costo total insumos</p>
          <p className="text-2xl font-bold text-violet-700">${costoTotalProyecto.toFixed(0)}</p>
        </div>
      </div>

      {/* Botón agregar */}
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Catálogo de insumos</p>
        <button onClick={() => setOpen((v) => !v)} className="bg-stone-900 hover:bg-stone-800 text-white text-xs px-4 py-2 rounded-lg font-semibold transition">
          {open ? 'Cancelar' : '+ Agregar insumo'}
        </button>
      </div>

      {/* Formulario */}
      {open && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Nuevo insumo</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-stone-500 mb-0.5 block">Nombre *</label>
              <input type="text" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Tela algodón 240g" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))} className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-400">
                <option value="">— Seleccionar —</option>
                {TIPOS_INSUMO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Proveedor</label>
              <input type="text" value={form.proveedor} onChange={(e) => setForm((p) => ({ ...p, proveedor: e.target.value }))} placeholder="Opcional" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Cantidad</label>
              <div className="flex gap-2">
                <input type="number" value={form.cantidad} onChange={(e) => setForm((p) => ({ ...p, cantidad: parseFloat(e.target.value) || 0 }))} min="0" step="0.1" className="w-24 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
                <select value={form.unidad} onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))} className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-violet-400">
                  {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-0.5 block">Costo unitario ($)</label>
              <input type="number" value={form.costoUnitario} onChange={(e) => setForm((p) => ({ ...p, costoUnitario: parseFloat(e.target.value) || 0 }))} min="0" step="0.01" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={guardar} disabled={saving || !form.nombre.trim()} className="bg-stone-900 text-white text-sm px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40">
              {saving ? 'Guardando...' : 'Guardar insumo'}
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-stone-500 px-4 py-2.5">Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {proyecto.insumos.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-2xl p-10 text-center">
          <p className="text-stone-400 text-sm">Registrá los materiales e insumos necesarios para este diseño.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {proyecto.insumos.map((ins) => (
            <InsumoRow key={ins.id} insumo={ins} proyectoId={proyecto.id} onRefresh={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}
