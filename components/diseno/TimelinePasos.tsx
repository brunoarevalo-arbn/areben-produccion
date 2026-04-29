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
  id:              string;
  numeroPaso:      number;
  nombrePaso:      string;
  estado:          string;
  saltado:         boolean;
  observaciones?:  string | null;
  datos?:          string | null;
  fechaInicio?:    string | null;
  fechaCompletado?: string | null;
  updatedAt:       string;
}

interface Props {
  proyectoId: string;
  pasos:      Paso[];
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

function FormEncogimiento({ datos, setDatos, onSave, saving, preData, postData }: {
  datos: DatosMap; setDatos: (fn: (d: DatosMap) => DatosMap) => void; onSave: () => void; saving: boolean; preData?: DatosMap; postData?: DatosMap;
}) {
  const medidas  = CAMPOS_MEDIDAS.filter((c) => c.key !== 'talle');
  const hayDatos = preData || postData;
  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Análisis de encogimiento</p>
      {hayDatos ? (
        <div className="overflow-x-auto rounded-lg border border-stone-100">
          <table className="w-full text-xs">
            <thead className="bg-stone-50">
              <tr className="text-stone-400">
                <th className="text-left px-3 py-2 font-semibold">Medida</th>
                <th className="text-center px-2 py-2 font-semibold">Pre (cm)</th>
                <th className="text-center px-2 py-2 font-semibold">Post (cm)</th>
                <th className="text-center px-2 py-2 font-semibold">Dif.</th>
                <th className="text-center px-2 py-2 font-semibold">Enc. %</th>
              </tr>
            </thead>
            <tbody>
              {medidas.map(({ key, label }) => {
                const pre  = preData?.[key]  ? parseFloat(preData[key])  : null;
                const post = postData?.[key] ? parseFloat(postData[key]) : null;
                const diff = pre !== null && post !== null ? post - pre : null;
                const pct  = pre !== null && diff !== null && pre !== 0 ? ((Math.abs(diff) / pre) * 100).toFixed(1) : null;
                return (
                  <tr key={key} className="border-t border-stone-50">
                    <td className="px-3 py-2 text-stone-600 font-medium">{label}</td>
                    <td className="px-2 py-2 text-center text-stone-500">{pre ?? '—'}</td>
                    <td className="px-2 py-2 text-center text-stone-500">{post ?? '—'}</td>
                    <td className={`px-2 py-2 text-center font-semibold ${diff !== null && diff < 0 ? 'text-amber-600' : 'text-stone-400'}`}>{diff !== null ? (diff > 0 ? '+' : '') + diff.toFixed(1) : '—'}</td>
                    <td className={`px-2 py-2 text-center font-bold ${pct ? 'text-red-500' : 'text-stone-300'}`}>{pct ? pct + '%' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-stone-400 italic">Completá los pasos de Medidas pre y post lavado para ver el cálculo automático.</p>
      )}
      <div>
        <label className="text-xs text-stone-400 mb-0.5 block">Recomendación de ajuste de moldería</label>
        <textarea value={datos.recomendacion ?? ''} onChange={(e) => setDatos((d) => ({ ...d, recomendacion: e.target.value }))} rows={2} placeholder="Ajuste recomendado según encogimiento..." className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
      </div>
      <button onClick={onSave} disabled={saving} className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition">
        {saving ? 'Guardando...' : 'Guardar análisis'}
      </button>
    </div>
  );
}

const CICLO: EstadoPaso[] = ['pendiente', 'en_proceso', 'completado'];

function PasoRow({ paso, proyectoId, onUpdate, preData, postData }: {
  paso: Paso; proyectoId: string; onUpdate: () => void; preData?: DatosMap; postData?: DatosMap;
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
          {paso.nombrePaso}
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

          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1.5">Observaciones</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Agregar notas sobre este paso..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
            <button onClick={guardarObs} disabled={savingObs || obs === (paso.observaciones ?? '')} className="mt-1.5 text-xs bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition">
              {savingObs ? 'Guardando...' : 'Guardar nota'}
            </button>
          </div>

          {tipoDatos === 'calce'       && <FormCalce       datos={datosForm} setDatos={setDatosForm} onSave={guardarDatos} saving={savingDatos} />}
          {tipoDatos === 'medidas'     && <FormMedidas     datos={datosForm} setDatos={setDatosForm} onSave={guardarDatos} saving={savingDatos} />}
          {tipoDatos === 'encogimiento'&& <FormEncogimiento datos={datosForm} setDatos={setDatosForm} onSave={guardarDatos} saving={savingDatos} preData={preData} postData={postData} />}
        </div>
      )}
    </div>
  );
}

export function TimelinePasos({ proyectoId, pasos }: Props) {
  const router      = useRouter();
  const activos     = pasos.filter((p) => !p.saltado);
  const completados = activos.filter((p) => p.estado === 'completado').length;
  const enProceso   = activos.filter((p) => p.estado === 'en_proceso').length;
  const saltados    = pasos.filter((p) => p.saltado).length;
  const pct         = activos.length > 0 ? Math.round((completados / activos.length) * 100) : 0;

  const parseDatos = (paso: Paso): DatosMap => {
    try { return paso.datos ? JSON.parse(paso.datos) : {}; } catch { return {}; }
  };

  const preData  = parseDatos(pasos.find((p) => p.nombrePaso === 'MEDIDAS PRE-LAVADO')  ?? { datos: null } as Paso);
  const postData = parseDatos(pasos.find((p) => p.nombrePaso === 'MEDIDAS POST-LAVADO') ?? { datos: null } as Paso);

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
            preData={paso.nombrePaso  === 'ANÁLISIS DE ENCOGIMIENTO' ? preData  : undefined}
            postData={paso.nombrePaso === 'ANÁLISIS DE ENCOGIMIENTO' ? postData : undefined}
          />
        ))}
      </div>
    </div>
  );
}
