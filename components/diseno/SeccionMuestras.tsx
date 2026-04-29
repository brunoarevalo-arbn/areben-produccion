'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ProyectoDiseno, IteracionMuestra, EstadoIteracion, TipoIteracion, AjusteMuestra } from '@/types/diseno';

const ESTADO_BADGE: Record<EstadoIteracion, string> = {
  en_confeccion: 'bg-amber-100 text-amber-700',
  lista:         'bg-blue-100 text-blue-700',
  rechazada:     'bg-red-100 text-red-700',
  aprobada:      'bg-emerald-100 text-emerald-700',
};

const ESTADO_LABEL: Record<EstadoIteracion, string> = {
  en_confeccion: 'En confección',
  lista:         'Lista',
  rechazada:     'Rechazada',
  aprobada:      'Aprobada',
};

const TIPO_BADGE: Record<TipoIteracion, string> = {
  muestra:       'bg-violet-100 text-violet-700',
  contramuestra: 'bg-orange-100 text-orange-700',
};

const TIPO_LABEL: Record<TipoIteracion, string> = {
  muestra:       'Muestra',
  contramuestra: 'Contramuestra',
};

function InsumoRow({
  iteracionId,
  proyectoId,
  onRefresh,
}: {
  iteracionId: string;
  proyectoId: string;
  onRefresh: () => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [nombre,   setNombre]   = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [unidad,   setUnidad]   = useState('m');
  const [costo,    setCosto]    = useState('0');
  const [saving,   setSaving]   = useState(false);

  const agregar = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    await fetch(`/api/proyectos/${proyectoId}/muestras/${iteracionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await fetch(`/api/proyectos/${proyectoId}/insumos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre:   nombre.trim(),
        cantidad: parseFloat(cantidad) || 1,
        unidad:   unidad || null,
        costo:    parseFloat(costo)    || 0,
      }),
    });
    setNombre(''); setCantidad('1'); setCosto('0'); setOpen(false);
    setSaving(false);
    onRefresh();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-violet-600 hover:text-violet-800 font-medium mt-1">
        + Insumo
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 bg-stone-50 rounded-xl border border-stone-100 space-y-2">
      <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Agregar insumo a esta muestra</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del insumo" className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-400 col-span-2" />
        <div className="flex gap-1">
          <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} min="0" step="0.1" className="w-20 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-400" />
          <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
            {['m', 'kg', 'unid', 'mt', 'cm', 'L'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-400">$</span>
          <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} min="0" step="0.01" className="flex-1 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={agregar} disabled={saving || !nombre.trim()} className="bg-stone-900 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40">
          {saving ? '...' : 'Agregar'}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-stone-500 px-2 py-1.5">Cancelar</button>
      </div>
    </div>
  );
}

function IteracionCard({
  iteracion,
  proyectoId,
  onRefresh,
}: {
  iteracion: IteracionMuestra;
  proyectoId: string;
  onRefresh: () => void;
}) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [notas,     setNotas]     = useState(iteracion.notas ?? '');
  const [editNotas, setEditNotas] = useState(false);
  const [newAjuste, setNewAjuste] = useState('');
  const [uploading, setUploading] = useState(false);

  const putIteracion = async (data: Record<string, unknown>) => {
    await fetch(`/api/proyectos/${proyectoId}/muestras/${iteracion.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    onRefresh();
  };

  const guardarNotas = async () => {
    await putIteracion({ notas });
    setEditNotas(false);
  };

  const subirFoto = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append('archivo', file);
    const res  = await fetch('/api/upload-imagen', { method: 'POST', body: form });
    const data = await res.json();
    await putIteracion({ fotos: [...iteracion.fotos, data.url] });
    setUploading(false);
  };

  const agregarAjuste = async () => {
    if (!newAjuste.trim()) return;
    await fetch(`/api/proyectos/${proyectoId}/ajustes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iteracionId: iteracion.id, descripcion: newAjuste.trim() }),
    });
    setNewAjuste('');
    onRefresh();
  };

  const toggleAjuste = async (ajuste: AjusteMuestra) => {
    const nuevoEstado = ajuste.estado === 'pendiente' ? 'realizado' : 'pendiente';
    await fetch(`/api/ajustes/${ajuste.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }),
    });
    onRefresh();
  };

  const tipo   = iteracion.tipo as TipoIteracion;
  const estado = iteracion.estado as EstadoIteracion;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className={`text-xs px-2.5 py-1 rounded-full font-bold ${TIPO_BADGE[tipo]}`}>
            {TIPO_LABEL[tipo]} v{iteracion.version}
          </div>
          <select
            value={estado}
            onChange={(e) => putIteracion({ estado: e.target.value })}
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border-0 cursor-pointer focus:outline-none ${ESTADO_BADGE[estado]}`}
          >
            {(Object.keys(ESTADO_LABEL) as EstadoIteracion[]).map((k) => (
              <option key={k} value={k}>{ESTADO_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-stone-400">
          {new Date(iteracion.createdAt).toLocaleDateString('es-AR')}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Fotos */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">Fotos</p>
          <div className="grid grid-cols-4 gap-2">
            {iteracion.fotos.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <button onClick={() => inputRef.current?.click()} disabled={uploading} className="aspect-square rounded-xl border-2 border-dashed border-stone-200 hover:border-violet-400 flex items-center justify-center text-stone-400 hover:text-violet-500 transition text-xl disabled:opacity-50">
              {uploading ? '…' : '+'}
            </button>
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); if (inputRef.current) inputRef.current.value = ''; }} />
        </div>

        {/* Notas */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Notas</p>
            {!editNotas && <button onClick={() => setEditNotas(true)} className="text-xs text-violet-600 hover:text-violet-800">Editar</button>}
          </div>
          {editNotas ? (
            <div>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none" placeholder="Observaciones sobre esta muestra..." />
              <div className="flex gap-2 mt-2">
                <button onClick={guardarNotas} className="bg-stone-900 text-white text-xs px-3 py-1.5 rounded-lg">Guardar</button>
                <button onClick={() => { setEditNotas(false); setNotas(iteracion.notas ?? ''); }} className="text-xs text-stone-500 px-3 py-1.5">Cancelar</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-600">{notas || <span className="text-stone-400 italic text-xs">Sin notas</span>}</p>
          )}
        </div>

        {/* Ajustes */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">Ajustes necesarios</p>
          <div className="space-y-1.5 mb-3">
            {iteracion.ajustes.length === 0 && <p className="text-xs text-stone-400 italic">Sin ajustes registrados</p>}
            {iteracion.ajustes.map((aj) => (
              <div key={aj.id} className="flex items-center gap-2.5">
                <button
                  onClick={() => toggleAjuste(aj)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${aj.estado !== 'pendiente' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-violet-400'}`}
                >
                  {aj.estado !== 'pendiente' && <span className="text-[10px]">✓</span>}
                </button>
                <span className={`text-sm ${aj.estado !== 'pendiente' ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                  {aj.descripcion}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newAjuste} onChange={(e) => setNewAjuste(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarAjuste(); } }} placeholder="Agregar ajuste..." className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-400" />
            <button onClick={agregarAjuste} disabled={!newAjuste.trim()} className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40">+</button>
          </div>
        </div>

        {/* Insumos de esta muestra */}
        {iteracion.insumos.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">Insumos usados</p>
            <div className="space-y-1">
              {iteracion.insumos.map((ins) => (
                <div key={ins.id} className="flex items-center justify-between text-xs text-stone-600 bg-stone-50 px-3 py-1.5 rounded-lg">
                  <span>{ins.nombre}</span>
                  <span className="text-stone-400">{ins.cantidad} {ins.unidad ?? ''} {ins.costo > 0 ? `· $${ins.costo}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <InsumoRow iteracionId={iteracion.id} proyectoId={proyectoId} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

export function SeccionMuestras({ proyecto }: { proyecto: ProyectoDiseno }) {
  const router   = useRouter();
  const [loading, setLoading] = useState(false);

  const crearIteracion = async (tipo: TipoIteracion) => {
    setLoading(true);
    await fetch(`/api/proyectos/${proyecto.id}/muestras`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo }),
    });
    setLoading(false);
    router.refresh();
  };

  const nSiguiente = (proyecto.iteraciones.length ?? 0) + 1;
  const ultimaAprobada = proyecto.iteraciones.some((it) => it.estado === 'aprobada');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">
          {proyecto.iteraciones.length === 0
            ? 'Sin muestras todavía'
            : `${proyecto.iteraciones.length} iteración${proyecto.iteraciones.length > 1 ? 'es' : ''}`}
        </h3>
        <div className="flex gap-2">
          {proyecto.iteraciones.length > 0 && (
            <button
              onClick={() => crearIteracion('contramuestra')}
              disabled={loading}
              className="bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs px-3 py-2 rounded-lg font-semibold transition disabled:opacity-50"
            >
              + Contramuestra
            </button>
          )}
          <button
            onClick={() => crearIteracion('muestra')}
            disabled={loading}
            className="bg-stone-900 hover:bg-stone-800 text-white text-xs px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Creando...' : `+ Muestra v${nSiguiente}`}
          </button>
        </div>
      </div>

      {proyecto.iteraciones.length === 0 && (
        <div className="border-2 border-dashed border-stone-200 rounded-2xl p-10 text-center">
          <p className="text-stone-400 text-sm">Creá la primera muestra para registrar el proceso.</p>
        </div>
      )}

      {/* Historial de iteraciones en orden */}
      {proyecto.iteraciones.length > 0 && (
        <div className="relative">
          {/* Línea vertical de historial */}
          <div className="absolute left-3.5 top-8 bottom-8 w-px bg-stone-200" />
          <div className="space-y-4">
            {proyecto.iteraciones.map((it) => (
              <div key={it.id} className="relative pl-10">
                <div className={`absolute left-0 top-4 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 ${
                  it.estado === 'aprobada'  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : it.estado === 'rechazada' ? 'bg-red-100 border-red-300 text-red-600'
                  : it.tipo === 'contramuestra' ? 'bg-orange-100 border-orange-300 text-orange-700'
                  : 'bg-violet-100 border-violet-300 text-violet-700'
                }`}>
                  {it.version}
                </div>
                <IteracionCard
                  iteracion={it}
                  proyectoId={proyecto.id}
                  onRefresh={() => router.refresh()}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {ultimaAprobada && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium text-center">
          Muestra aprobada — lista para continuar al siguiente paso
        </div>
      )}
    </div>
  );
}
