'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ESTADO_LABEL, ESTADO_COLOR, type EstadoProyecto } from '@/lib/diseno/estado';
import { parseFotos, type Foto } from '@/lib/diseno/fotos';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { MultiImageDrop } from '@/components/ui/ImageDrop';

interface Iteracion {
  id:              string;
  version:         number;
  estado:          string;
  fotos:           string[];
  notas:           string | null;
  ajustesMolderia: string | null;
  createdAt:       string;
}

interface FaseProy {
  id:              string;
  faseId:          string;
  nombre:          string;
  orden:           number;
  estado:          string;
  responsable:     string | null;
  externo:         boolean;
  seguidorInterno: string | null;
  fechaInicio:     string | null;
  fechaFin:        string | null;
  notas:           string | null;
}

interface CatalogoFase { id: string; nombre: string; orden: number; }

export interface Proyecto {
  id:            string;
  nombre:        string;
  marca:         string;
  inspiracion:   string | null;
  moodboard:     string | null;
  molderia:      string | null;
  tela:          string | null;
  archivado:     boolean;
  fechaObjetivo: string | null;
  iteraciones:   Iteracion[];
  fases:         FaseProy[];
}

interface Props { proyecto: Proyecto; catalogoFases: CatalogoFase[]; estadoActual: EstadoProyecto; }

export function ProyectoView({ proyecto, catalogoFases, estadoActual, volver = '/diseno' }: Props & { volver?: string }) {
  const router = useRouter();

  const refresh = () => router.refresh();

  const [editandoNombre,  setEditandoNombre]  = useState(false);
  const [nombreEdit,      setNombreEdit]      = useState(proyecto.nombre);
  const [guardandoNombre, setGuardandoNombre] = useState(false);

  const guardarNombre = async () => {
    const nombre = nombreEdit.trim();
    if (!nombre || nombre === proyecto.nombre) { setEditandoNombre(false); return; }
    setGuardandoNombre(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre }),
    });
    setGuardandoNombre(false);
    setEditandoNombre(false);
    refresh();
  };

  const archivar = async (archivado: boolean) => {
    if (archivado && !(await confirmAsync('¿Archivar este proyecto?'))) return;
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ archivado }),
    });
    refresh();
  };

  const eliminar = async () => {
    if (!(await confirmAsync({ message: `¿Eliminar el proyecto "${proyecto.nombre}"? No se puede deshacer.`, danger: true, confirmLabel: 'Eliminar' }))) return;
    await fetch(`/api/proyectos/${proyecto.id}`, { method: 'DELETE' });
    router.push('/diseno');
  };

  const iterActiva    = proyecto.iteraciones[proyecto.iteraciones.length - 1] ?? null;
  const hayAprobada   = proyecto.iteraciones.some((it) => it.estado === 'aprobada');
  const mostrarFases  = hayAprobada;

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <Link href={volver} className="text-xs text-stone-500 hover:text-stone-800 transition">
        ← Volver al Kanban
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {editandoNombre ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  autoFocus
                  value={nombreEdit}
                  onChange={(e) => setNombreEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  guardarNombre();
                    if (e.key === 'Escape') { setNombreEdit(proyecto.nombre); setEditandoNombre(false); }
                  }}
                  className="text-2xl font-bold text-stone-900 border-b-2 border-amber-400 focus:outline-none bg-transparent flex-1 min-w-0"
                />
                <Button onClick={guardarNombre} disabled={guardandoNombre} isLoading={guardandoNombre} size="sm" className="shrink-0">
                  Guardar
                </Button>
                <Button onClick={() => { setNombreEdit(proyecto.nombre); setEditandoNombre(false); }} variant="secondary" size="sm" className="shrink-0">
                  Cancelar
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-stone-900 truncate">{proyecto.nombre}</h1>
                <button onClick={() => { setNombreEdit(proyecto.nombre); setEditandoNombre(true); }}
                  title="Editar nombre"
                  className="text-stone-400 hover:text-stone-700 transition shrink-0 text-sm leading-none">
                  ✎
                </button>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${ESTADO_COLOR[estadoActual]}`}>
                  {ESTADO_LABEL[estadoActual]}
                </span>
              </>
            )}
          </div>
          <p className="text-stone-400 text-sm">{proyecto.marca}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!proyecto.archivado ? (
            <Button onClick={() => archivar(true)} variant="secondary" size="sm">
              Archivar
            </Button>
          ) : (
            <Button onClick={() => archivar(false)} variant="secondary" size="sm">
              Desarchivar
            </Button>
          )}
          <button onClick={eliminar}
            className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:border-red-400 transition">
            Eliminar
          </button>
        </div>
      </div>

      {/* Próximo paso */}
      <ProximoPaso
        estado={estadoActual}
        proyectoId={proyecto.id}
        iterActiva={iterActiva}
        onChange={refresh}
      />

      {/* Inspiración */}
      <SeccionInspiracion proyecto={proyecto} onChange={refresh} />

      {/* Moodboard */}
      <SeccionMoodboard proyecto={proyecto} />

      {/* Muestras */}
      <SeccionMuestras
        proyectoId={proyecto.id}
        iteraciones={proyecto.iteraciones}
        onChange={refresh}
      />

      {/* Fases (solo si hay muestra aprobada) */}
      {mostrarFases && (
        <SeccionFases
          proyectoId={proyecto.id}
          catalogoFases={catalogoFases}
          fases={proyecto.fases}
          onChange={refresh}
        />
      )}
    </div>
  );
}

// ───────────────────────── Próximo paso ─────────────────────────

function ProximoPaso({
  estado, proyectoId, iterActiva, onChange,
}: {
  estado: EstadoProyecto; proyectoId: string; iterActiva: Iteracion | null; onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const crearMuestra = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyectoId}/muestras`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setSaving(false);
    onChange();
  };

  const aprobarMuestra = async () => {
    if (!iterActiva) return;
    setSaving(true);
    await fetch(`/api/proyectos/${proyectoId}/muestras/${iterActiva.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ estado: 'aprobada' }),
    });
    setSaving(false);
    onChange();
  };

  if (estado === 'inspiracion') {
    return (
      <Box color="violet">
        <p className="text-sm font-semibold text-violet-900">Próximo paso</p>
        <p className="text-sm text-violet-800 mt-1">Cargá la primera muestra cuando esté en confección.</p>
        <button onClick={crearMuestra} disabled={saving}
          className="mt-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          {saving ? '...' : 'Crear muestra v1'}
        </button>
      </Box>
    );
  }

  if (estado === 'muestra') {
    return (
      <Box color="amber">
        <p className="text-sm font-semibold text-amber-900">Próximo paso</p>
        <p className="text-sm text-amber-800 mt-1">
          Cuando vuelva la muestra v{iterActiva?.version}, dejá notas de qué falló y/o aprobala para pasar a producción.
        </p>
        <button onClick={aprobarMuestra} disabled={saving}
          className="mt-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          {saving ? '...' : `Aprobar muestra v${iterActiva?.version}`}
        </button>
      </Box>
    );
  }

  if (estado === 'aprobado') {
    return (
      <Box color="sky">
        <p className="text-sm font-semibold text-sky-900">Próximo paso</p>
        <p className="text-sm text-sky-800 mt-1">Muestra aprobada. Iniciá las fases que correspondan más abajo.</p>
      </Box>
    );
  }

  if (estado === 'produccion') {
    return (
      <Box color="emerald">
        <p className="text-sm font-semibold text-emerald-900">Próximo paso</p>
        <p className="text-sm text-emerald-800 mt-1">Hay fases en curso. Marcalas como completadas cuando terminen.</p>
      </Box>
    );
  }

  if (estado === 'terminado') {
    return (
      <Box color="stone">
        <p className="text-sm font-semibold text-stone-700">Terminado</p>
        <p className="text-sm text-stone-600 mt-1">Todas las fases del proyecto están completadas. Podés archivarlo cuando quieras.</p>
      </Box>
    );
  }

  return (
    <Box color="stone">
      <p className="text-sm font-semibold text-stone-600">Archivado</p>
      <p className="text-sm text-stone-500 mt-1">Este proyecto está archivado. Desarchivalo para seguir trabajándolo.</p>
    </Box>
  );
}

function Box({ color, children }: { color: 'violet' | 'amber' | 'sky' | 'emerald' | 'stone'; children: React.ReactNode }) {
  const cls = {
    violet:  'bg-violet-50  border-violet-200',
    amber:   'bg-amber-50   border-amber-200',
    sky:     'bg-sky-50     border-sky-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    stone:   'bg-stone-50   border-stone-200',
  }[color];
  return <div className={`rounded-2xl border-2 ${cls} p-5`}>{children}</div>;
}

// ───────────────────────── Moodboard ─────────────────────────

function SeccionMoodboard({ proyecto }: { proyecto: Proyecto }) {
  const [fotos, setFotos] = useState<Foto[]>(() => parseFotos(proyecto.moodboard));
  const guardar = async (nuevas: Foto[]) => {
    setFotos(nuevas);
    await fetch(`/api/proyectos/${proyecto.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ moodboard: nuevas }) });
  };
  return (
    <Card padding="none" className="p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Moodboard · inspo</p>
      <MultiImageDrop value={fotos} onChange={guardar} />
    </Card>
  );
}

// ───────────────────────── Inspiración ─────────────────────────

function SeccionInspiracion({ proyecto, onChange }: { proyecto: Proyecto; onChange: () => void }) {
  const [editing,     setEditing]     = useState(false);
  const [inspiracion, setInspiracion] = useState(proyecto.inspiracion ?? '');
  const [molderia,    setMolderia]    = useState(proyecto.molderia ?? '');
  const [tela,        setTela]        = useState(proyecto.tela ?? '');
  const [saving,      setSaving]      = useState(false);
  // Sugerencias de telas reales (insumos categoría=tela) y molderías del catálogo.
  const [telaOpts,     setTelaOpts]     = useState<string[]>([]);
  const [molderiaOpts, setMolderiaOpts] = useState<string[]>([]);

  useEffect(() => {
    if (!editing) return;
    fetch('/api/insumos').then((r) => r.ok ? r.json() : []).then((ins) =>
      setTelaOpts((ins as { categoria: string; activo: boolean; nombre: string }[])
        .filter((i) => i.categoria === 'tela' && i.activo).map((i) => i.nombre)));
    fetch('/api/molderias').then((r) => r.ok ? r.json() : []).then((ms) =>
      setMolderiaOpts((ms as { activo: boolean; nombre: string }[])
        .filter((m) => m.activo).map((m) => m.nombre)));
  }, [editing]);

  const guardar = async () => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyecto.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inspiracion: inspiracion.trim(), molderia: molderia.trim(), tela: tela.trim() }),
    });
    setSaving(false);
    setEditing(false);
    onChange();
  };

  return (
    <Card padding="none" className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Inspiración / base</p>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-stone-500 hover:text-stone-800 transition">
            Editar
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          <textarea value={inspiracion} onChange={(e) => setInspiracion(e.target.value)}
            placeholder="Link de Pinterest, idea base, descripción…" rows={4}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <input value={molderia} onChange={(e) => setMolderia(e.target.value)} placeholder="Moldería" list="molderias-list"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
            <input value={tela} onChange={(e) => setTela(e.target.value)} placeholder="Tela" list="telas-list"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
            <datalist id="molderias-list">{molderiaOpts.map((m) => <option key={m} value={m} />)}</datalist>
            <datalist id="telas-list">{telaOpts.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="flex gap-2">
            <Button onClick={guardar} disabled={saving} isLoading={saving} size="sm">
              Guardar
            </Button>
            <Button onClick={() => {
              setEditing(false);
              setInspiracion(proyecto.inspiracion ?? '');
              setMolderia(proyecto.molderia ?? '');
              setTela(proyecto.tela ?? '');
            }} variant="secondary" size="sm">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {proyecto.inspiracion ? (
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{proyecto.inspiracion}</p>
          ) : (
            <p className="text-sm text-stone-400 italic">Sin notas todavía.</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-stone-500 pt-1">
            {proyecto.molderia && <span><strong className="text-stone-600">Molderia:</strong> {proyecto.molderia}</span>}
            {proyecto.tela     && <span><strong className="text-stone-600">Tela:</strong> {proyecto.tela}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── Muestras ─────────────────────────

function SeccionMuestras({
  proyectoId, iteraciones, onChange,
}: {
  proyectoId: string; iteraciones: Iteracion[]; onChange: () => void;
}) {
  const [creando, setCreando] = useState(false);

  const crearNueva = async () => {
    setCreando(true);
    await fetch(`/api/proyectos/${proyectoId}/muestras`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setCreando(false);
    onChange();
  };

  return (
    <Card padding="none" className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Muestras</p>
        {iteraciones.length > 0 && (
          <Button onClick={crearNueva} disabled={creando} isLoading={creando} variant="secondary" size="sm">
            {`+ Nueva versión (v${iteraciones.length + 1})`}
          </Button>
        )}
      </div>
      {iteraciones.length === 0 ? (
        <p className="text-sm text-stone-400 italic">Sin muestras todavía.</p>
      ) : (
        <div className="space-y-3">
          {iteraciones.map((it) => (
            <MuestraRow key={it.id} proyectoId={proyectoId} iteracion={it} onChange={onChange} />
          ))}
        </div>
      )}
    </Card>
  );
}

const MUESTRA_ESTADO_COLOR: Record<string, string> = {
  en_confeccion: 'bg-stone-100  text-stone-600',
  lista:         'bg-amber-100  text-amber-700',
  rechazada:     'bg-red-100    text-red-700',
  aprobada:      'bg-emerald-100 text-emerald-700',
};

const MUESTRA_ESTADO_LABEL: Record<string, string> = {
  en_confeccion: 'En confección',
  lista:         'Volvió',
  rechazada:     'Rechazada',
  aprobada:      'Aprobada',
};

function MuestraRow({
  proyectoId, iteracion, onChange,
}: {
  proyectoId: string; iteracion: Iteracion; onChange: () => void;
}) {
  const [expanded,        setExpanded]        = useState(iteracion.estado !== 'aprobada');
  const [notas,           setNotas]           = useState(iteracion.notas ?? '');
  const [ajustesMolderia, setAjustesMolderia] = useState(iteracion.ajustesMolderia ?? '');
  const [fotos,           setFotos]           = useState<string>(iteracion.fotos.join('\n'));
  const [saving,          setSaving]          = useState(false);

  const guardar = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    const fotosArr = fotos.split('\n').map((s) => s.trim()).filter(Boolean);
    await fetch(`/api/proyectos/${proyectoId}/muestras/${iteracion.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        notas:           notas.trim(),
        ajustesMolderia: ajustesMolderia.trim(),
        fotos:           fotosArr,
        ...extra,
      }),
    });
    setSaving(false);
    onChange();
  };

  const setEstado = async (estado: string) => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyectoId}/muestras/${iteracion.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ estado }),
    });
    setSaving(false);
    onChange();
  };

  const eliminar = async () => {
    if (!(await confirmAsync({ message: `¿Eliminar la muestra v${iteracion.version}?`, danger: true, confirmLabel: 'Eliminar' }))) return;
    await fetch(`/api/proyectos/${proyectoId}/muestras/${iteracion.id}`, { method: 'DELETE' });
    onChange();
  };

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-stone-700">v{iteracion.version}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${MUESTRA_ESTADO_COLOR[iteracion.estado] ?? 'bg-stone-100 text-stone-500'}`}>
            {MUESTRA_ESTADO_LABEL[iteracion.estado] ?? iteracion.estado}
          </span>
          {iteracion.ajustesMolderia && (
            <span className="text-xs text-violet-600" title="Tiene ajustes de molderia">📐</span>
          )}
        </div>
        <span className="text-stone-400 text-xs">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Textarea label="Qué falló de la muestra" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Largo corto, hilo equivocado, falta etiqueta…"
              rows={4}
              fullWidth
              className="resize-none" />
            <Textarea label="Ajustes a la molderia" value={ajustesMolderia} onChange={(e) => setAjustesMolderia(e.target.value)}
              placeholder={iteracion.version === 1
                ? 'Molderia base por crear, o usar existente "Top básico mod 12"…'
                : 'Subí 2 cm el largo, ajusté la espalda, etc.'}
              rows={4}
              fullWidth
              className="resize-none" />
          </div>
          <Textarea label="Fotos (un link por línea)" value={fotos} onChange={(e) => setFotos(e.target.value)}
            placeholder="https://…"
            rows={2}
            fullWidth
            className="resize-none font-mono text-xs" />
          {iteracion.fotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {iteracion.fotos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-stone-200" />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={() => guardar()} disabled={saving} isLoading={saving} size="sm">
              Guardar
            </Button>
            {iteracion.estado !== 'aprobada' && (
              <>
                <button onClick={() => setEstado('aprobada')} disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
                  Aprobar
                </button>
                <button onClick={() => setEstado('rechazada')} disabled={saving}
                  className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-xs px-3 py-1.5 rounded-lg font-semibold transition">
                  Rechazar
                </button>
              </>
            )}
            {iteracion.estado === 'aprobada' && (
              <Button onClick={() => setEstado('lista')} disabled={saving} variant="secondary" size="sm">
                Des-aprobar
              </Button>
            )}
            <button onClick={eliminar}
              className="ml-auto text-xs text-red-500 hover:text-red-700 transition">
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Fases ─────────────────────────

function SeccionFases({
  proyectoId, catalogoFases, fases, onChange,
}: {
  proyectoId: string; catalogoFases: CatalogoFase[]; fases: FaseProy[]; onChange: () => void;
}) {
  const fasesPorFaseId = new Map(fases.map((f) => [f.faseId, f]));

  const iniciar = async (faseId: string) => {
    await fetch(`/api/proyectos/${proyectoId}/fases`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ faseId }),
    });
    onChange();
  };

  return (
    <Card padding="none" className="p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Producción — Fases</p>
      <div className="space-y-2">
        {catalogoFases.map((c) => {
          const fp = fasesPorFaseId.get(c.id);
          if (fp) return <FaseIniciada key={c.id} proyectoId={proyectoId} fase={fp} onChange={onChange} />;
          return (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5 border border-stone-200 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold bg-stone-100 text-stone-500 rounded px-2 py-0.5">{c.orden}</span>
                <span className="text-sm text-stone-600">{c.nombre}</span>
              </div>
              <Button onClick={() => iniciar(c.id)} size="sm">
                Iniciar
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const FASE_ESTADO_COLOR: Record<string, string> = {
  en_progreso: 'bg-amber-100   text-amber-700',
  completada:  'bg-emerald-100 text-emerald-700',
};

const FASE_ESTADO_LABEL: Record<string, string> = {
  en_progreso: 'En progreso',
  completada:  'Completada',
};

function FaseIniciada({
  proyectoId, fase, onChange,
}: {
  proyectoId: string; fase: FaseProy; onChange: () => void;
}) {
  const [expanded,        setExpanded]        = useState(fase.estado === 'en_progreso');
  const [responsable,     setResponsable]     = useState(fase.responsable ?? '');
  const [externo,         setExterno]         = useState(fase.externo);
  const [seguidorInterno, setSeguidorInterno] = useState(fase.seguidorInterno ?? '');
  const [notas,           setNotas]           = useState(fase.notas ?? '');
  const [saving,          setSaving]          = useState(false);

  const guardar = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    await fetch(`/api/proyectos/${proyectoId}/fases/${fase.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        responsable:     responsable.trim() || null,
        externo,
        seguidorInterno: externo ? (seguidorInterno.trim() || null) : null,
        notas:           notas.trim() || null,
        ...extra,
      }),
    });
    setSaving(false);
    onChange();
  };

  const completar = () => guardar({ estado: 'completada' });
  const reabrir   = () => guardar({ estado: 'en_progreso' });

  const desinciar = async () => {
    if (!(await confirmAsync({ message: `¿Deshacer el inicio de la fase "${fase.nombre}"? Se borra el registro.`, danger: true, confirmLabel: 'Deshacer' }))) return;
    await fetch(`/api/proyectos/${proyectoId}/fases/${fase.id}`, { method: 'DELETE' });
    onChange();
  };

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold bg-stone-200 text-stone-700 rounded px-2 py-0.5">{fase.orden}</span>
          <span className="text-sm font-medium text-stone-800 truncate">{fase.nombre}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${FASE_ESTADO_COLOR[fase.estado]}`}>
            {FASE_ESTADO_LABEL[fase.estado]}
          </span>
          {fase.responsable && (
            <span className="text-xs text-stone-500 truncate hidden sm:inline">· {fase.responsable}{fase.externo ? ' (ext.)' : ''}</span>
          )}
        </div>
        <span className="text-stone-400 text-xs shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-stone-500">
              Responsable
              <input value={responsable} onChange={(e) => setResponsable(e.target.value)}
                placeholder="Nombre o taller"
                className="mt-1 w-full px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
            </label>
            <label className="text-xs text-stone-500 flex flex-col">
              <span>Tipo</span>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setExterno(false)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${!externo ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500'}`}>
                  Interno
                </button>
                <button type="button" onClick={() => setExterno(true)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${externo ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-500'}`}>
                  Externo
                </button>
              </div>
            </label>
            {externo && (
              <label className="text-xs text-stone-500 md:col-span-2">
                Seguidor interno
                <input value={seguidorInterno} onChange={(e) => setSeguidorInterno(e.target.value)}
                  placeholder="Quién hace seguimiento del externo"
                  className="mt-1 w-full px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400" />
              </label>
            )}
          </div>
          <label className="text-xs text-stone-500 block">
            Notas
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 resize-none" />
          </label>
          <div className="text-xs text-stone-400 flex flex-wrap gap-3">
            {fase.fechaInicio && <span>Inicio: {new Date(fase.fechaInicio).toLocaleDateString('es-AR')}</span>}
            {fase.fechaFin    && <span>Fin: {new Date(fase.fechaFin).toLocaleDateString('es-AR')}</span>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => guardar()} disabled={saving} isLoading={saving} size="sm">
              Guardar
            </Button>
            {fase.estado === 'en_progreso' ? (
              <button onClick={completar} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">
                Marcar completada
              </button>
            ) : (
              <Button onClick={reabrir} disabled={saving} variant="secondary" size="sm">
                Reabrir
              </Button>
            )}
            <button onClick={desinciar}
              className="ml-auto text-xs text-red-500 hover:text-red-700 transition">
              Deshacer inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
