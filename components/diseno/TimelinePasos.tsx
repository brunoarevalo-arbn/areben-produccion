'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ESTADO_PASO_LABEL,
  ESTADO_PASO_COLOR,
  PASOS_CON_DATOS,
  CAMPOS_MEDIDAS,
  type EstadoPaso,
  type TipoDatos,
} from '@/lib/constants/diseno';

interface Paso {
  id:                   string;
  numeroPaso:           number;
  nombrePaso:           string;
  estado:               string;
  saltado:              boolean;
  observaciones?:       string | null;
  datos?:               string | null;
  fechaInicio?:         string | null;
  fechaCompletado?:     string | null;
  responsableId?:       string | null;
  esTercero?:           boolean;
  terceroNombre?:       string | null;
  responsableInternoId?: string | null;
  updatedAt:            string;
}

interface UsuarioSimple {
  id:     string;
  nombre: string;
}

interface Props {
  proyectoId: string;
  pasos:      Paso[];
  usuarios:   UsuarioSimple[];
}

type DatosMap = Record<string, string>;

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function FormCalce({ datos, setDatos, onSave, saving }: {
  datos: DatosMap; setDatos: (fn: (d: DatosMap) => DatosMap) => void; onSave: () => void; saving: boolean;
}) {
  const campo = (key: string, label: string, placeholder: string, rows?: number) => (
    <div key={key}>
      <label className="text-xs text-stone-400 mb-0.5 block">{label}</label>
      {rows ? (
        <textarea value={datos[key] ?? ''} onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))} rows={rows} placeholder={placeholder} className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
      ) : (
        <input type="text" value={datos[key] ?? ''} onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))} placeholder={placeholder} className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
      )}
    </div>
  );
  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Datos del calce</p>
      {campo('talle', 'Talle probado', 'Ej: M')}
      {campo('observaciones', 'Observaciones del calce', 'Cómo quedó el calce...', 2)}
      {campo('ajustes', 'Ajustes necesarios', 'Cambios a realizar en moldería...', 2)}
      <button onClick={onSave} disabled={saving} className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition">
        {saving ? 'Guardando...' : 'Guardar calce'}
      </button>
    </div>
  );
}

function FormMedidas({ datos, setDatos, onSave, saving }: {
  datos: DatosMap; setDatos: (fn: (d: DatosMap) => DatosMap) => void; onSave: () => void; saving: boolean;
}) {
  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Medidas</p>
      <div className="grid grid-cols-2 gap-2">
        {CAMPOS_MEDIDAS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-stone-400 mb-0.5 block">{label}</label>
            <input type="text" value={datos[key] ?? ''} onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))} placeholder={placeholder} className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
          </div>
        ))}
      </div>
      <button onClick={onSave} disabled={saving} className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition">
        {saving ? 'Guardando...' : 'Guardar medidas'}
      </button>
    </div>
  );
}


const CICLO: EstadoPaso[] = ['pendiente', 'en_proceso', 'completado'];

function PasoRow({ paso, proyectoId, onUpdate, usuarios }: {
  paso: Paso; proyectoId: string; onUpdate: () => void; usuarios: UsuarioSimple[];
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saltando,    setSaltando]    = useState(false);
  const [obs,         setObs]         = useState(paso.observaciones ?? '');
  const [savingObs,   setSavingObs]   = useState(false);
  const [datosForm,   setDatosForm]   = useState<DatosMap>(() => {
    try { return paso.datos ? JSON.parse(paso.datos) : {}; } catch { return {}; }
  });
  const [savingDatos, setSavingDatos] = useState(false);

  const [esTercero,            setEsTercero]            = useState(paso.esTercero ?? false);
  const [responsableId,        setResponsableId]        = useState(paso.responsableId ?? '');
  const [terceroNombre,        setTerceroNombre]        = useState(paso.terceroNombre ?? '');
  const [responsableInternoId, setResponsableInternoId] = useState(paso.responsableInternoId ?? '');
  const [savingResp,           setSavingResp]           = useState(false);

  const estado   = paso.estado as EstadoPaso;
  const saltado  = paso.saltado;
  const tipoDatos: TipoDatos | undefined = PASOS_CON_DATOS[paso.nombrePaso];

  const patchPaso = async (body: Record<string, unknown>) => {
    await fetch(`/api/proyectos/${proyectoId}/pasos/${paso.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    onUpdate();
  };

  const avanzar = async () => {
    if (saving || saltado) return;
    const idx      = CICLO.indexOf(estado);
    const siguiente = CICLO[(idx + 1) % CICLO.length];
    setSaving(true);
    await patchPaso({ estado: siguiente });
    setSaving(false);
  };

  const toggleSaltado = async () => {
    setSaltando(true);
    await patchPaso({ saltado: !saltado });
    setSaltando(false);
  };

  const guardarObs = async () => {
    setSavingObs(true);
    await patchPaso({ observaciones: obs });
    setSavingObs(false);
  };

  const guardarDatos = async () => {
    setSavingDatos(true);
    await patchPaso({ datos: JSON.stringify(datosForm) });
    setSavingDatos(false);
  };

  const guardarResponsable = async () => {
    setSavingResp(true);
    await patchPaso({
      esTercero:            esTercero,
      responsableId:        esTercero ? null : (responsableId || null),
      terceroNombre:        esTercero ? (terceroNombre || null) : null,
      responsableInternoId: esTercero ? (responsableInternoId || null) : null,
    });
    setSavingResp(false);
  };

  const nombreResponsable = () => {
    if (paso.esTercero) {
      const interno = usuarios.find((u) => u.id === paso.responsableInternoId);
      return paso.terceroNombre
        ? `${paso.terceroNombre}${interno ? ` (resp. interno: ${interno.nombre})` : ''}`
        : null;
    }
    const u = usuarios.find((u) => u.id === paso.responsableId);
    return u ? u.nombre : null;
  };

  const rowBg = saltado
    ? 'bg-stone-50 border-stone-100 opacity-60'
    : estado === 'completado' ? 'bg-emerald-50 border-emerald-100'
    : estado === 'en_proceso' ? 'bg-amber-50 border-amber-100'
    : 'bg-white border-stone-100';

  return (
    <div className={`rounded-xl border transition-colors ${rowBg}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Número / check */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          saltado        ? 'bg-stone-200 text-stone-400'
          : estado === 'completado' ? 'bg-emerald-500 text-white'
          : estado === 'en_proceso' ? 'bg-amber-400 text-white'
          : 'bg-stone-200 text-stone-500'
        }`}>
          {saltado ? '—' : estado === 'completado' ? '✓' : paso.numeroPaso}
        </div>

        {/* Nombre */}
        <button
          onClick={() => !saltado && setExpanded((v) => !v)}
          className={`flex-1 text-left text-sm font-medium ${
            saltado        ? 'text-stone-400 line-through'
            : estado === 'completado' ? 'text-emerald-700 line-through decoration-emerald-300'
            : estado === 'en_proceso' ? 'text-amber-800'
            : 'text-stone-700'
          }`}
        >
          <span>{paso.nombrePaso}</span>
          {nombreResponsable() && !saltado && (
            <span className="ml-2 text-xs font-normal text-stone-400">
              {paso.esTercero ? '🏢' : '👤'} {nombreResponsable()}
            </span>
          )}
          {(paso.observaciones || paso.datos) && !saltado && (
            <span className="ml-1.5 text-stone-300 text-xs">●</span>
          )}
        </button>

        {/* Badge estado o "Saltado" */}
        {saltado ? (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-100 text-stone-400">
            Saltado
          </span>
        ) : (
          <button
            onClick={avanzar}
            disabled={saving}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer active:scale-95 transition-all disabled:opacity-50 select-none ${ESTADO_PASO_COLOR[estado]}`}
            title="Click para avanzar"
          >
            {saving ? '…' : ESTADO_PASO_LABEL[estado]}
          </button>
        )}

        {/* Botón saltar / reactivar */}
        <button
          onClick={toggleSaltado}
          disabled={saltando}
          title={saltado ? 'Reactivar paso' : 'Marcar como opcional / saltar'}
          className="text-stone-300 hover:text-stone-500 transition text-xs w-5 text-center shrink-0 disabled:opacity-40"
        >
          {saltado ? '↩' : '⊘'}
        </button>

        {/* Chevron */}
        {!saltado && (
          <button onClick={() => setExpanded((v) => !v)} className="text-stone-300 hover:text-stone-500 transition text-xs w-4 text-center shrink-0">
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {expanded && !saltado && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-100 pt-3">
          <p className="text-xs text-stone-400">Último cambio: {fechaCorta(paso.updatedAt)}</p>

          {/* Responsable */}
          <div>
            <p className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">Responsable</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button type="button" onClick={() => setEsTercero(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${!esTercero ? 'bg-violet-100 text-violet-700 border-transparent' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  Interno
                </button>
                <button type="button" onClick={() => setEsTercero(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${esTercero ? 'bg-amber-100 text-amber-700 border-transparent' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  Tercero / Externo
                </button>
              </div>

              {!esTercero && (
                <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                  <option value="">— Sin asignar —</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              )}

              {esTercero && (
                <div className="space-y-2">
                  <input type="text" value={terceroNombre} onChange={(e) => setTerceroNombre(e.target.value)}
                    placeholder="Nombre del tercero / proveedor"
                    className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
                  <div>
                    <label className="text-xs text-stone-400 mb-0.5 block">Responsable interno que asume</label>
                    <select value={responsableInternoId} onChange={(e) => setResponsableInternoId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-violet-400">
                      <option value="">— Sin asignar —</option>
                      {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <button onClick={guardarResponsable} disabled={savingResp}
                className="text-xs bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition">
                {savingResp ? 'Guardando...' : 'Guardar responsable'}
              </button>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1.5">Observaciones</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Agregar notas sobre este paso..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
            <button onClick={guardarObs} disabled={savingObs || obs === (paso.observaciones ?? '')} className="mt-1.5 text-xs bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition">
              {savingObs ? 'Guardando...' : 'Guardar nota'}
            </button>
          </div>

          {tipoDatos === 'calce'   && <FormCalce   datos={datosForm} setDatos={setDatosForm} onSave={guardarDatos} saving={savingDatos} />}
          {tipoDatos === 'medidas' && <FormMedidas datos={datosForm} setDatos={setDatosForm} onSave={guardarDatos} saving={savingDatos} />}
        </div>
      )}
    </div>
  );
}

export function TimelinePasos({ proyectoId, pasos, usuarios }: Props) {
  const router      = useRouter();
  const activos     = pasos.filter((p) => !p.saltado);
  const completados = activos.filter((p) => p.estado === 'completado').length;
  const enProceso   = activos.filter((p) => p.estado === 'en_proceso').length;
  const saltados    = pasos.filter((p) => p.saltado).length;
  const pct         = activos.length > 0 ? Math.round((completados / activos.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-stone-700">
            {completados} / {activos.length} pasos completados
            {saltados > 0 && <span className="text-stone-400 font-normal text-xs ml-2">({saltados} saltado{saltados > 1 ? 's' : ''})</span>}
          </span>
          <div className="flex gap-3 text-xs text-stone-400">
            {enProceso > 0 && <span className="text-amber-600 font-medium">{enProceso} en proceso</span>}
            <span className="font-bold text-stone-600">{pct}%</span>
          </div>
        </div>
        <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Click en el nombre para notas · click en el badge para cambiar estado · ⊘ para saltar/reactivar
        </p>
      </div>

      <div className="space-y-1.5">
        {pasos.map((paso) => (
          <PasoRow
            key={paso.id}
            paso={paso}
            proyectoId={proyectoId}
            onUpdate={() => router.refresh()}
            usuarios={usuarios}
          />
        ))}
      </div>
    </div>
  );
}
