'use client';

import { useEffect, useState } from 'react';
import { ImageDrop } from '@/components/ui/ImageDrop';
import { LoadingState } from '@/components/ui/LoadingState';
import { toast } from '@/components/ui/Toaster';
import { Ventana } from './Acciones';

// "Nueva producción" desde el tablero: un modelo (LoteProduccion) con una orden por color,
// con el mismo endpoint que la cola (`POST /api/produccion/lote`). El geometral es opcional:
// si se sube, queda como el del modelo para todos los colores.
interface Entrada { categoria: 'marca' | 'prenda' | 'color'; nombre: string; abreviatura: string; activo: boolean }

const CAMPO = 'h-9 w-full rounded-lg border border-stone-300 px-2.5 text-sm bg-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200';

export function NuevaProduccion({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: () => void }) {
  const [catalogo, setCatalogo] = useState<Entrada[] | null>(null);
  const [marca, setMarca] = useState('');
  const [prenda, setPrenda] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');
  const [colores, setColores] = useState([{ color: '', cantidad: '' }]);
  const [geometral, setGeometral] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch('/api/sku-catalogo').then((r) => r.json()).then((d) => setCatalogo(Array.isArray(d) ? d.filter((e: Entrada) => e.activo) : [])).catch(() => setCatalogo([]));
  }, []);
  const de = (c: Entrada['categoria']) => (catalogo ?? []).filter((e) => e.categoria === c);

  const crear = async () => {
    setError('');
    if (!marca || !prenda) { setError('Elegí marca y prenda'); return; }
    const variantes = colores.filter((v) => v.color && parseInt(v.cantidad) > 0).map((v) => ({ color: v.color, cantidad: parseInt(v.cantidad) }));
    if (variantes.length === 0) { setError('Agregá al menos un color con cantidad'); return; }
    setGuardando(true);
    const r = await fetch('/api/produccion/lote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marca, prenda, descripcion, notas, variantes }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setGuardando(false); setError(d.error || 'No se pudo crear'); return; }
    if (geometral && d.lote?.id) {
      const g = await fetch('/api/produccion/geometral', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loteId: d.lote.id, url: geometral }) });
      if (!g.ok) toast.error('Se creó la producción, pero no se guardó el geometral: subilo desde el panel');
    }
    setGuardando(false);
    toast.success(`Producción creada: ${variantes.length} ${variantes.length === 1 ? 'color' : 'colores'}`);
    onCreada();
  };

  return (
    <Ventana titulo="Nueva producción" onCerrar={onCerrar} ancho="max-w-2xl">
      {!catalogo ? <LoadingState /> : (
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-[1fr_auto] gap-4">
            <div className="grid gap-3 content-start">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-[12.5px] font-semibold text-stone-700">Marca
                  <select value={marca} onChange={(e) => setMarca(e.target.value)} className={CAMPO}>
                    <option value="">Elegí</option>{de('marca').map((m) => <option key={m.abreviatura} value={m.abreviatura}>{m.nombre}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[12.5px] font-semibold text-stone-700">Prenda
                  <select value={prenda} onChange={(e) => setPrenda(e.target.value)} className={CAMPO}>
                    <option value="">Elegí</option>{de('prenda').map((m) => <option key={m.abreviatura} value={m.abreviatura}>{m.nombre}</option>)}
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-[12.5px] font-semibold text-stone-700">Descripción
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Por ejemplo: Bikini AYLA triangulito envivado" className={CAMPO} />
              </label>
            </div>
            <div className="grid gap-1 content-start">
              <span className="text-[12.5px] font-semibold text-stone-700">Geometral del modelo</span>
              <ImageDrop contain value={geometral} onChange={setGeometral} />
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-[12.5px] font-semibold text-stone-700">Colores y cantidad planificada</span>
            {colores.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_32px] gap-2">
                <select value={v.color} aria-label={`Color ${i + 1}`} onChange={(e) => setColores((c) => c.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} className={CAMPO}>
                  <option value="">Elegí un color</option>{de('color').map((m) => <option key={m.abreviatura} value={m.abreviatura}>{m.nombre}</option>)}
                </select>
                <input inputMode="numeric" aria-label={`Cantidad ${i + 1}`} placeholder="Cant." value={v.cantidad} onChange={(e) => setColores((c) => c.map((x, j) => (j === i ? { ...x, cantidad: e.target.value.replace(/\D/g, '') } : x)))} className={CAMPO} />
                <button type="button" aria-label="Quitar color" disabled={colores.length === 1} onClick={() => setColores((c) => c.filter((_, j) => j !== i))}
                  className="h-9 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30">×</button>
              </div>
            ))}
            <button type="button" onClick={() => setColores((c) => [...c, { color: '', cantidad: '' }])} className="justify-self-start text-[13px] font-semibold text-amber-600 hover:text-amber-700">+ Otro color</button>
          </div>

          <label className="grid gap-1 text-[12.5px] font-semibold text-stone-700">Notas
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={`${CAMPO} h-auto py-2`} />
          </label>

          {error && <p className="text-[13px] text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="h-9 px-3 rounded-lg text-[13px] font-semibold text-stone-600 hover:bg-stone-100">Cancelar</button>
            <button type="button" onClick={crear} disabled={guardando} className="h-9 px-3 rounded-lg text-[13px] font-semibold bg-amber-400 text-stone-900 hover:bg-amber-500 disabled:opacity-50">{guardando ? 'Creando…' : 'Crear producción'}</button>
          </div>
        </div>
      )}
    </Ventana>
  );
}
