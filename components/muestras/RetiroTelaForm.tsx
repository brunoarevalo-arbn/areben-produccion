'use client';

import { useState, useEffect, useMemo } from 'react';
import { NumInput } from '@/components/ui/NumInput';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { MARCAS, type Marca } from '@/lib/marcas';

export interface RolloOpt {
  id: string;
  codigo: string;
  pesoActual: string;
  estado: string;
  insumo: { nombre: string; rinde: string | null } | null;
  color: { nombre: string } | null;
  colorProveedor: string | null;
}

const inp = 'w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400';

export const fmt = (n: string | number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
export const colorRollo = (r: { color: { nombre: string } | null; colorProveedor: string | null }) =>
  r.color?.nombre || r.colorProveedor || 'sin color';

// El stock vive en kg; con el rinde (metros por kg) se muestra en metros, que es
// como se piensa y se corta la tela.
export const restanteTxt = (r: RolloOpt) => {
  const rinde = Number(r.insumo?.rinde);
  return rinde > 0 ? `${fmt(Number(r.pesoActual) * rinde)} m` : `${fmt(r.pesoActual)} kg`;
};

const disponible = (r: RolloOpt) =>
  r.estado !== 'AGOTADO' && r.estado !== 'DESCARTADO' && Number(r.pesoActual) > 0;

/** Retiro ya cargado que se está editando. Sembra el formulario. */
export interface RetiroEditable {
  id: string;
  rolloId: string;
  metros: number;
  marca: Marca | '';
  proyectoId: string | null;
  descripcion: string | null;
}

/**
 * Formulario de retiro de tela para muestras. Se usa en tres contextos:
 * la pantalla /muestras (con buscador de rollo), el modal que se abre desde
 * un rollo concreto (`rolloIdFijo`, sin buscador) y la edición de un retiro
 * ya cargado (`retiro`).
 *
 * Nota de diseño: el retiro es de METROS a granel, sin imputar prenda por prenda.
 * La marca sí es obligatoria: es lo que hace que el gasto de desarrollo caiga en
 * la marca correcta.
 */
export function RetiroTelaForm({
  rolloIdFijo,
  onRegistrado,
  autoFocus,
  retiro,
  onCancelar,
}: {
  rolloIdFijo?: string;
  onRegistrado?: () => void;
  autoFocus?: boolean;
  retiro?: RetiroEditable;
  onCancelar?: () => void;
}) {
  // En edición el rollo queda fijo: cambiarlo no es editar, son dos operaciones.
  const rolloFijo = retiro?.rolloId ?? rolloIdFijo;

  const [rollos, setRollos]       = useState<RolloOpt[]>([]);
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);

  const [rolloId, setRolloId]         = useState(rolloFijo ?? '');
  const [busqueda, setBusqueda]       = useState('');
  const [cantidad, setCantidad]       = useState(retiro?.metros ?? 0);
  const [marca, setMarca]             = useState<Marca | ''>(retiro?.marca ?? '');
  const [proyectoId, setProyectoId]   = useState(retiro?.proyectoId ?? '');
  const [descripcion, setDescripcion] = useState(retiro?.descripcion ?? '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    // El rollo fijo entra aunque esté agotado: si el retiro que se edita lo agotó,
    // igual hay que poder mostrarlo y corregirlo.
    fetch('/api/insumos/rollos').then((r) => r.ok ? r.json() : []).then((rs: RolloOpt[]) =>
      setRollos(rs.filter((r) => disponible(r) || r.id === rolloFijo))).catch(() => {});
    fetch('/api/proyectos').then((r) => r.ok ? r.json() : []).then((ps: { id: string; nombre: string }[]) =>
      setProyectos(ps.map((p) => ({ id: p.id, nombre: p.nombre })))).catch(() => {});
  }, [rolloFijo]);

  const rolloSel = rollos.find((r) => r.id === rolloId);

  // Buscador: filtra por código, insumo y color. Con decenas de rollos, un
  // <select> plano es la fricción principal para cargar el retiro.
  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rollos.slice(0, 8);
    return rollos.filter((r) =>
      `${r.codigo} ${r.insumo?.nombre ?? ''} ${colorRollo(r)}`.toLowerCase().includes(q)).slice(0, 8);
  }, [rollos, busqueda]);

  const enviar = (confirmado: boolean) => fetch(
    retiro ? `/api/produccion/muestras/${retiro.id}` : '/api/produccion/muestras',
    {
      method: retiro ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // El rollo no viaja al editar: el endpoint lo rechaza a propósito.
        ...(retiro ? {} : { rolloId }),
        cantidad, marca,
        proyectoId:  retiro ? (proyectoId  || null) : (proyectoId  || undefined),
        descripcion: retiro ? (descripcion || null) : (descripcion || undefined),
        ...(confirmado ? { confirmarDuplicado: true } : {}),
      }),
    },
  );

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guarda dura contra el reenvío por cualquier vía (Enter repetido, evento
    // sintético en touch), no solo por el botón deshabilitado.
    if (saving) return;
    if (!rolloId || !cantidad || !marca) return;
    setSaving(true);
    setError('');
    try {
      let r = await enviar(false);

      // El servidor avisa si esto parece un envío repetido; no bloquea, pregunta.
      if (r.status === 409) {
        const d = await r.json().catch(() => ({}));
        if (d.code !== 'POSIBLE_DUPLICADO') { setError(d.error || 'No se pudo guardar'); return; }
        const ok = await confirmAsync({
          title: '¿Retiro repetido?',
          message: d.error,
          confirmLabel: 'Sí, cargarlo igual',
          cancelLabel: 'No, cancelar',
          danger: true,
        });
        if (!ok) return;
        r = await enviar(true);
      }

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || (retiro ? 'Error al guardar los cambios' : 'Error al registrar el retiro'));
        return;
      }

      toast.success(retiro
        ? `Retiro actualizado: ${fmt(cantidad)} m de ${rolloSel?.codigo ?? 'el rollo'}`
        : `Retirados ${fmt(cantidad)} m de ${rolloSel?.codigo ?? 'el rollo'}`);

      // "Guardar y seguir": se mantiene la marca (un viaje suele ser de la misma
      // marca) y se limpia el resto para cargar la tela siguiente. Al editar no
      // se limpia nada: el modal se cierra.
      if (!retiro) {
        if (!rolloIdFijo) { setRolloId(''); setBusqueda(''); }
        setCantidad(0); setProyectoId(''); setDescripcion('');
      }
      onRegistrado?.();
    } catch {
      // Sin esto, una caída de red dejaba el botón girando para siempre y sin
      // mensaje: el usuario recargaba y volvía a cargar el retiro. Así se duplicó
      // un retiro en producción.
      setError('No se pudo conectar. El retiro NO se guardó: revisá la conexión y probá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-4">
      {/* Rollo */}
      <div>
        <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Rollo del que se retira</label>
        {rolloSel ? (
          <div className="flex items-center gap-2 flex-wrap px-3 py-2.5 border border-stone-200 rounded-xl bg-stone-50">
            <span className="font-mono font-semibold text-sm text-stone-700">{rolloSel.codigo}</span>
            <span className="text-sm text-stone-600 truncate">
              {rolloSel.insumo?.nombre ?? '?'} · {colorRollo(rolloSel)}
            </span>
            <span className="text-xs text-stone-400 ml-auto whitespace-nowrap">quedan {restanteTxt(rolloSel)}</span>
            {!rolloFijo && (
              <button type="button" onClick={() => { setRolloId(''); setBusqueda(''); }}
                className="text-xs text-amber-600 hover:text-amber-700 font-semibold underline">
                cambiar
              </button>
            )}
          </div>
        ) : (
          <>
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              autoFocus={autoFocus} placeholder="Buscá por código, tela o color — ej. R-0025, microfibra, negro"
              aria-label="Buscar rollo" className={inp} />
            <div className="mt-2 border border-stone-100 rounded-xl divide-y divide-stone-100 overflow-hidden">
              {resultados.length === 0 ? (
                <p className="text-sm text-stone-400 px-3 py-3">Ningún rollo coincide.</p>
              ) : resultados.map((r) => (
                <button key={r.id} type="button" onClick={() => setRolloId(r.id)}
                  className="w-full text-left px-3 py-3 hover:bg-amber-50 transition flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-sm text-stone-700">{r.codigo}</span>
                  <span className="text-sm text-stone-600 truncate">
                    {r.insumo?.nombre ?? '?'} · {colorRollo(r)}
                  </span>
                  <span className="text-xs text-stone-400 ml-auto whitespace-nowrap">quedan {restanteTxt(r)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {retiro && (
          <p className="text-xs text-stone-400 mt-1.5">
            Para cambiar el rollo, eliminá el retiro y cargalo de nuevo.
          </p>
        )}
      </div>

      {/* Metros + marca */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
            Cuántos metros <span className="text-stone-400 font-normal">(obligatorio)</span>
          </label>
          <NumInput value={cantidad} onChange={setCantidad} min="0"
            placeholder={rolloSel ? `quedan ${restanteTxt(rolloSel)}` : 'en metros'} className={inp} />
          {retiro && (
            <p className="text-xs text-stone-400 mt-1.5">
              Estaban cargados {fmt(retiro.metros)} m. El rollo se ajusta por la diferencia.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
            Para qué marca <span className="text-stone-400 font-normal">(obligatorio)</span>
          </label>
          <div className="flex gap-2">
            {MARCAS.map((m) => (
              <button key={m} type="button" onClick={() => setMarca(m)} aria-pressed={marca === m}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  marca === m
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                }`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Opcionales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
            Proyecto <span className="text-stone-400 font-normal">(opcional)</span>
          </label>
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={inp}>
            <option value="">— Sin proyecto —</option>
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600 mb-1.5 block">
            Nota <span className="text-stone-400 font-normal">(opcional)</span>
          </label>
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. muestras varias" className={inp} />
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <div className="flex gap-2 flex-col sm:flex-row">
        <Button type="submit" variant="primary" size="lg" isLoading={saving}
          disabled={!rolloId || !cantidad || !marca} className="w-full sm:w-auto">
          {saving ? 'Guardando...' : retiro ? 'Guardar cambios' : 'Registrar retiro'}
        </Button>
        {onCancelar && (
          <Button type="button" variant="secondary" size="lg" onClick={onCancelar}
            disabled={saving} className="w-full sm:w-auto">
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
