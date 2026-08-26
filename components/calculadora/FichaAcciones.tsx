'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { NumInput } from '@/components/ui/NumInput';
import { toast } from '@/components/ui/Toaster';
import { confirmAsync } from '@/components/ui/ConfirmProvider';
import { MAQUINAS } from '@/lib/constants/maquinas';

interface PasoPropuesto { orden: number; nombre: string; maquina: string }
interface Props {
  corridaId: string;
  modo: string;
  estado: string;
  tipoPrenda: string;
  talle: string;
  escandalloId: string | null;
  aplicada: boolean;
  listoParaAplicar: boolean;
  escandallos: { id: string; nombre: string; sku: string | null; marca: string | null }[];
  propuesta: PasoPropuesto[];
  resumen: { promedio: number; ultima: number; mejor: number; unidadesMedidas: number };
  tieneRibetes: boolean;
}

const nMin = (n: number) => n.toString().replace('.', ',');

export function FichaAcciones(p: Props) {
  const router = useRouter();

  // ── Aprobar el proceso ────────────────────────────────────────────────
  const [pasos, setPasos] = useState<PasoPropuesto[]>(p.propuesta);
  const [aprobando, setAprobando] = useState(false);

  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= pasos.length) return;
    const next = [...pasos];
    [next[i], next[j]] = [next[j], next[i]];
    setPasos(next.map((x, k) => ({ ...x, orden: k + 1 })));
  };
  const partir = (i: number) => {
    const next = [...pasos];
    next.splice(i + 1, 0, { orden: 0, nombre: `${pasos[i].nombre} (2)`, maquina: pasos[i].maquina });
    setPasos(next.map((x, k) => ({ ...x, orden: k + 1 })));
  };
  const quitar = (i: number) => setPasos(pasos.filter((_, k) => k !== i).map((x, k) => ({ ...x, orden: k + 1 })));

  const aprobar = async () => {
    setAprobando(true);
    const r = await fetch('/api/calculadora/procesos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoPrenda: p.tipoPrenda, origenCorridaId: p.corridaId, pasos }),
    });
    setAprobando(false);
    if (!r.ok) { toast.error((await r.json()).error ?? 'No se pudo aprobar'); return; }
    toast.success(`Proceso de ${p.tipoPrenda} aprobado`);
    router.refresh();
  };

  // ── Aplicar al escandallo ─────────────────────────────────────────────
  const [escandalloId, setEscandalloId] = useState(p.escandalloId ?? '');
  const [modoEstandar, setModoEstandar] = useState<'promedio' | 'ultima' | 'mejor'>('promedio');
  const [tipoPaso, setTipoPaso] = useState<'pct' | 'cm'>('pct');
  const [paso, setPaso] = useState(4);
  const [tallesTxt, setTallesTxt] = useState('');
  const [aplicando, setAplicando] = useState(false);

  const talles = tallesTxt.split(',').map((t) => t.trim()).filter(Boolean);

  const aplicar = async () => {
    const body = {
      escandalloId, modo: modoEstandar,
      aplicarTiempo: true, aplicarRibetes: p.tieneRibetes,
      talles,
      ...(tipoPaso === 'cm' ? { pasoCm: paso } : { pasoPercent: paso }),
    };

    setAplicando(true);
    const prev = await fetch(`/api/calculadora/corridas/${p.corridaId}/aplicar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, preview: true }),
    });
    setAplicando(false);
    if (!prev.ok) { toast.error((await prev.json()).error ?? 'No se pudo calcular'); return; }
    const { cambios } = await prev.json() as { cambios: { campo: string; antes: string; despues: string }[] };

    // El diff se muestra ANTES de escribir: no se toca el costo callado.
    const ok = await confirmAsync({
      message: `Se va a escribir en el escandallo:\n\n${cambios.map((c) => `• ${c.campo}\n   ${c.antes}  →  ${c.despues}`).join('\n\n')}`,
      confirmLabel: 'Aplicar',
    });
    if (!ok) return;

    setAplicando(true);
    const r = await fetch(`/api/calculadora/corridas/${p.corridaId}/aplicar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setAplicando(false);
    if (!r.ok) { toast.error((await r.json()).error ?? 'No se pudo aplicar'); return; }
    toast.success('Aplicado al escandallo');
    router.refresh();
  };

  return (
    <div className="space-y-6 print:hidden">
      {p.modo === 'relevamiento' && p.estado === 'terminada' && pasos.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
            Guardar como proceso de {p.tipoPrenda}
          </p>
          <p className="text-xs text-stone-400 mb-4 leading-relaxed">
            Los pasos en el orden en que ocurrieron, cada uno con la máquina en la que más tiempo se
            trabajó. Corregilo antes de aprobar: de acá en adelante toda corrida de {p.tipoPrenda}{' '}
            nace con esta lista. Las corridas ya medidas no se tocan.
          </p>

          <ol className="space-y-2 mb-4">
            {pasos.map((x, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-5 tabular-nums">{i + 1}.</span>
                <input value={x.nombre}
                  onChange={(e) => setPasos(pasos.map((y, k) => k === i ? { ...y, nombre: e.target.value } : y))}
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                <select value={x.maquina}
                  onChange={(e) => setPasos(pasos.map((y, k) => k === i ? { ...y, maquina: e.target.value } : y))}
                  className="border border-stone-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:border-amber-400">
                  {MAQUINAS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <button onClick={() => mover(i, -1)} aria-label="Subir" className="text-stone-300 hover:text-stone-600 px-1">↑</button>
                <button onClick={() => mover(i, 1)} aria-label="Bajar" className="text-stone-300 hover:text-stone-600 px-1">↓</button>
                <button onClick={() => partir(i)} title="Partir en dos pasos" className="text-stone-400 hover:text-amber-600 text-xs px-1">partir</button>
                <button onClick={() => quitar(i)} aria-label="Quitar" className="text-stone-300 hover:text-red-500 px-1">✕</button>
              </li>
            ))}
          </ol>

          <Button onClick={aprobar} isLoading={aprobando}>Aprobar el proceso</Button>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Aplicar al escandallo</p>

        {!p.listoParaAplicar && (
          <p className="text-sm text-stone-400 mb-4">
            La corrida tiene que estar terminada y con al menos una prenda medida.
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <Select label="Escandallo" fullWidth value={escandalloId} onChange={(e) => setEscandalloId(e.target.value)}>
            <option value="">— Elegí el escandallo —</option>
            {p.escandallos.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.sku ? ` · ${e.sku}` : ''}</option>)}
          </Select>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Minutos a usar</label>
            <div className="flex gap-1">
              {([
                ['promedio', `Promedio ${nMin(p.resumen.promedio)}`],
                ['ultima',   `Última ${nMin(p.resumen.ultima)}`],
                ['mejor',    `Mejor ${nMin(p.resumen.mejor)}`],
              ] as const).map(([k, txt]) => (
                <button key={k} onClick={() => setModoEstandar(k)}
                  className={`flex-1 text-xs px-2 py-2.5 rounded-xl border-2 font-semibold transition ${modoEstandar === k ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                  {txt}
                </button>
              ))}
            </div>
            {p.resumen.unidadesMedidas < 2 && (
              <p className="text-xs text-amber-700 mt-1">
                Con {p.resumen.unidadesMedidas} prenda medida los tres números son el mismo: sale de una sola observación.
              </p>
            )}
          </div>
        </div>

        {p.tieneRibetes && (
          <div className="bg-stone-50 rounded-xl p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-3">
              Curva de ribete · el talle medido es {p.talle}
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Talles de la curva</label>
                <input value={tallesTxt} onChange={(e) => setTallesTxt(e.target.value)}
                  placeholder="1, 2, 3, 4, 5"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                <p className="text-xs text-stone-400 mt-1">
                  Separados por coma y del más chico al más grande. Si {p.talle} no está, se agrega solo.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Cuánto crece por escalón</label>
                <div className="flex gap-2 items-center">
                  <NumInput value={paso} onChange={setPaso}
                    className="w-24 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                  <div className="flex gap-1">
                    {(['pct', 'cm'] as const).map((t) => (
                      <button key={t} onClick={() => setTipoPaso(t)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${tipoPaso === t ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-500'}`}>
                        {t === 'pct' ? '%' : 'cm'}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-stone-400 mt-1">Un talle que ya hayas corregido a mano no se pisa.</p>
              </div>
            </div>
          </div>
        )}

        <Button onClick={aplicar} isLoading={aplicando} disabled={!p.listoParaAplicar || !escandalloId}>
          Ver qué cambia y aplicar
        </Button>
        {p.aplicada && <span className="ml-3 text-xs text-stone-400">Ya se aplicó una vez; volver a aplicar pisa los valores.</span>}
      </div>
    </div>
  );
}
