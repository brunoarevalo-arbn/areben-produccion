'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParamState } from '@/lib/hooks/useParamState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { NumInput } from '@/components/ui/NumInput';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';

interface Corrida {
  id: string; nombre: string; tipoPrenda: string; marca: string; modo: string;
  talle: string; costurera: string; estado: string;
  unidadesObjetivo: number; escandalloId: string | null; aplicadaAt: string | null;
  resumen: { promedio: number; unidadesMedidas: number; desvios: { sistematico: boolean }[] };
}
interface Proceso { id: string; tipoPrenda: string; version: number; pasos: { orden: number; nombre: string; maquina: string }[] }
interface Escandallo { id: string; nombre: string; sku: string | null; marca: string | null; tipoPrenda: string | null }

const ESTADO_LABEL: Record<string, { txt: string; cls: string }> = {
  pendiente: { txt: 'Esperando en la tablet', cls: 'bg-stone-100 text-stone-600' },
  en_curso:  { txt: 'Cosiendo',               cls: 'bg-emerald-100 text-emerald-700' },
  terminada: { txt: 'Terminada',              cls: 'bg-sky-100 text-sky-700' },
  anulada:   { txt: 'Anulada',                cls: 'bg-red-100 text-red-600' },
};

export function CorridasClient() {
  const [tab, setTab] = useParamState<'activas' | 'terminadas'>('tab', 'activas');
  const [loading, setLoading] = useState(true);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [costureras, setCostureras] = useState<string[]>([]);
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [escandallos, setEscandallos] = useState<Escandallo[]>([]);
  const [abrirAlta, setAbrirAlta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Renombrar una corrida ya creada: {id, nombre} mientras se edita.
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null);

  const [f, setF] = useState({
    nombre: '', tipoPrenda: '', marca: 'Zattia', talle: '', costurera: '',
    unidadesObjetivo: 3, escandalloId: '', sku: '', notas: '',
  });
  // El ancho del ribete lo define DISEÑO, no la costurera: sale de la
  // cortacollaretas. Ella sólo mide los largos que salen del tubo.
  const [ribetes, setRibetes] = useState<{ nombre: string; anchoCm: number }[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/calculadora/corridas');
    if (r.ok) {
      const d = await r.json();
      setCorridas(d.corridas); setCostureras(d.costureras);
      setProcesos(d.procesos); setEscandallos(d.escandallos);
    }
    setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // El modo no se elige: sin proceso vigente para ese tipo de prenda, la corrida
  // sale a descubrir los pasos en vez de recorrer una lista escrita de memoria.
  const proceso = procesos.find((p) => p.tipoPrenda.trim().toLowerCase() === f.tipoPrenda.trim().toLowerCase());
  const esRelevamiento = f.tipoPrenda.trim() !== '' && !proceso;

  const crear = async () => {
    setGuardando(true);
    const r = await fetch('/api/calculadora/corridas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...f,
        escandalloId: f.escandalloId || null,
        sku: f.sku || null,
        notas: f.notas || null,
        ribetes: ribetes.filter((r) => r.nombre.trim() !== ''),
      }),
    });
    setGuardando(false);
    if (!r.ok) { toast.error((await r.json()).error ?? 'No se pudo crear'); return; }
    toast.success(esRelevamiento ? 'Relevamiento enviado a la tablet' : 'Corrida enviada a la tablet');
    setAbrirAlta(false);
    setF({ ...f, nombre: '', talle: '', sku: '', notas: '' });
    setRibetes([]);
    cargar();
  };

  const renombrar = async () => {
    if (!renombrando) return;
    const nombre = renombrando.nombre.trim();
    if (nombre === '') { toast.error('El nombre no puede quedar vacío'); return; }
    setGuardando(true);
    const r = await fetch(`/api/calculadora/corridas/${renombrando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    });
    setGuardando(false);
    if (!r.ok) { toast.error((await r.json()).error ?? 'No se pudo renombrar'); return; }
    setRenombrando(null);
    toast.success('Nombre cambiado');
    cargar();
  };

  const borrar = async (c: Corrida) => {
    const ok = await confirmAsync({
      message: `¿Borrar la corrida "${c.nombre}"? Se pierden los tiempos medidos.`,
      danger: true, confirmLabel: 'Borrar',
    });
    if (!ok) return;
    const r = await fetch(`/api/calculadora/corridas/${c.id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Corrida borrada'); cargar(); } else toast.error('No se pudo borrar');
  };

  if (loading) return <LoadingState />;

  const visibles = corridas.filter((c) =>
    tab === 'activas' ? c.estado === 'pendiente' || c.estado === 'en_curso' : c.estado === 'terminada' || c.estado === 'anulada');

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex gap-1">
          {(['activas', 'terminadas'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === t ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>
              {t === 'activas' ? 'En curso' : 'Terminadas'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/calculadora/procesos" className="text-sm text-stone-500 hover:text-stone-800 px-3 py-2">Procesos</Link>
          <Button onClick={() => setAbrirAlta((v) => !v)}>{abrirAlta ? 'Cerrar' : '+ Nueva corrida'}</Button>
        </div>
      </div>

      {abrirAlta && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Input label="Prenda" fullWidth value={f.nombre} placeholder="Ej: Bikini Girlhood"
              onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <Input label="Tipo de prenda" fullWidth value={f.tipoPrenda} placeholder="Ej: Bikini"
              hint="Es lo que agrupa el proceso: todas las bikinis comparten sus pasos."
              onChange={(e) => setF({ ...f, tipoPrenda: e.target.value })} />
            <Select label="Marca" fullWidth value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })}>
              <option>Zattia</option><option>Stunned</option>
            </Select>
            <Input label="Talle que se cose" fullWidth value={f.talle} placeholder="Ej: 2 · M"
              hint="Es el talle en el que se van a medir los centímetros de ribete."
              onChange={(e) => setF({ ...f, talle: e.target.value })} />
            <Select label="Costurera" fullWidth value={f.costurera} onChange={(e) => setF({ ...f, costurera: e.target.value })}>
              <option value="">— Elegí —</option>
              {costureras.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Prendas a coser</label>
              <NumInput value={f.unidadesObjetivo} onChange={(n) => setF({ ...f, unidadesObjetivo: n })}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
              <p className="text-xs text-stone-400 mt-1">Con 3 se ve bajar el tiempo; con 1 el número sale de una sola observación.</p>
            </div>
            <Select label="Escandallo a costear (opcional)" fullWidth value={f.escandalloId}
              onChange={(e) => setF({ ...f, escandalloId: e.target.value })}>
              <option value="">— Elegir después —</option>
              {escandallos.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.sku ? ` · ${e.sku}` : ''}</option>)}
            </Select>
          </div>

          {esRelevamiento && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                &quot;{f.tipoPrenda}&quot; todavía no tiene proceso: esta corrida lo va a descubrir.
              </p>
              <p className="text-xs text-amber-800 mt-1">
                La tablet arranca sin lista y la costurera declara cada paso con su máquina mientras
                cose. Al terminar vas a poder aprobar esa secuencia como el proceso de la prenda.
              </p>
            </div>
          )}
          {proceso && (
            <div className="bg-stone-50 rounded-xl px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">
                Proceso v{proceso.version} · {proceso.pasos.length} pasos
              </p>
              <ol className="text-sm text-stone-600 space-y-0.5">
                {proceso.pasos.map((p) => (
                  <li key={p.orden}>{p.orden}. {p.nombre} <span className="text-stone-400">· {p.maquina}</span></li>
                ))}
              </ol>
            </div>
          )}

          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">Ribetes de esta prenda</p>
            <p className="text-xs text-stone-400 mb-3">
              El <strong>ancho</strong> lo definís vos: sale de la cortacollaretas. En la tablet la
              costurera sólo carga los <strong>largos</strong> que van saliendo del tubo, y el
              desperdicio que tira cuando viene una unión.
            </p>
            <div className="space-y-2">
              {ribetes.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={r.nombre} placeholder="Ej: Bajo Busto"
                    onChange={(e) => setRibetes(ribetes.map((x, k) => k === i ? { ...x, nombre: e.target.value } : x))}
                    className="flex-1 min-w-0 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                  <NumInput value={r.anchoCm} aria-label="Ancho en cm"
                    onChange={(n) => setRibetes(ribetes.map((x, k) => k === i ? { ...x, anchoCm: n } : x))}
                    className="w-24 border border-stone-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:border-amber-400" />
                  <span className="text-xs text-stone-400 shrink-0">cm ancho</span>
                  <button onClick={() => setRibetes(ribetes.filter((_, k) => k !== i))}
                    aria-label="Quitar ribete" className="text-stone-300 hover:text-red-500 px-1 shrink-0">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setRibetes([...ribetes, { nombre: '', anchoCm: 0 }])}
              className="mt-2 text-xs text-stone-400 hover:text-amber-600 font-semibold">+ Agregar ribete</button>
          </div>

          <Button onClick={crear} isLoading={guardando}
            disabled={!f.nombre || !f.tipoPrenda || !f.talle || !f.costurera}>
            Enviar a la tablet
          </Button>
        </div>
      )}

      {visibles.length === 0 && (
        <EmptyState icon="📐" title="No hay corridas acá"
          message={tab === 'activas' ? 'Encendé una corrida y va a aparecer en la tablet de la costurera.' : 'Todavía no se terminó ninguna.'} />
      )}

      <div className="space-y-2">
        {visibles.map((c) => {
          const est = ESTADO_LABEL[c.estado] ?? ESTADO_LABEL.pendiente;
          const hallazgo = c.resumen.desvios.some((d) => d.sistematico);
          return (
            <div key={c.id} className="bg-white border border-stone-200 rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {renombrando?.id === c.id ? (
                    <span className="flex items-center gap-2">
                      <input value={renombrando.nombre} autoFocus
                        onChange={(e) => setRenombrando({ id: c.id, nombre: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renombrar();
                          if (e.key === 'Escape') setRenombrando(null);
                        }}
                        className="border border-stone-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                      <button onClick={renombrar} disabled={guardando}
                        className="text-xs font-semibold text-amber-600 hover:text-amber-700 disabled:opacity-50">Guardar</button>
                      <button onClick={() => setRenombrando(null)}
                        className="text-xs text-stone-400 hover:text-stone-600">Cancelar</button>
                    </span>
                  ) : (
                    <>
                      <Link href={`/calculadora/${c.id}?volverA=${encodeURIComponent(`/calculadora?tab=${tab}`)}`}
                        className="font-semibold text-stone-900 hover:text-amber-600">
                        {c.nombre} · {c.talle}
                      </Link>
                      <button onClick={() => setRenombrando({ id: c.id, nombre: c.nombre })}
                        aria-label="Cambiar el nombre" title="Cambiar el nombre"
                        className="text-stone-300 hover:text-amber-600 text-xs">✎</button>
                    </>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${est.cls}`}>{est.txt}</span>
                  {c.modo === 'relevamiento' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">Relevamiento</span>
                  )}
                  {hallazgo && <span className="text-xs text-amber-600" title="Hay un desvío de máquina en todas las prendas">⚠ el proceso tiene un hallazgo</span>}
                  {c.aplicadaAt && <span className="text-xs text-stone-400">✓ aplicada al escandallo</span>}
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {c.marca} · {c.tipoPrenda} · {c.costurera} · {c.resumen.unidadesMedidas}/{c.unidadesObjetivo} prendas
                  {c.resumen.promedio > 0 && ` · ${c.resumen.promedio.toString().replace('.', ',')} min/prenda`}
                </p>
              </div>
              <button onClick={() => borrar(c)} aria-label="Borrar corrida"
                className="text-stone-300 hover:text-red-500 text-sm px-2 shrink-0">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
