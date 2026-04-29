'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Foto } from '@/types/diseno';

interface GaleriaFotosProps {
  productoId: string;
  fotos: Foto[];
}

export function GaleriaFotos({ productoId, fotos: fotosIniciales }: GaleriaFotosProps) {
  const [fotos,     setFotos]     = useState<Foto[]>(fotosIniciales);
  const [subiendo,  setSubiendo]  = useState(false);
  const [preview,   setPreview]   = useState<string | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const router    = useRouter();

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    // Preview local inmediato
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(archivo);

    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('archivo',    archivo);
      form.append('productoId', productoId);

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Error subiendo foto');

      const nuevaFoto: Foto = await res.json();
      setFotos((prev) => [...prev, nuevaFoto]);
      setPreview(null);
      router.refresh();
    } catch (err) {
      alert('Error subiendo la foto');
      setPreview(null);
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {fotos.map((foto) => (
          <div key={foto.id} className="relative group aspect-square overflow-hidden rounded-xl bg-stone-100">
            <img src={foto.url} alt={foto.nombre ?? 'foto'} className="w-full h-full object-cover" />
          </div>
        ))}

        {preview && (
          <div className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 opacity-60">
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-white font-semibold bg-stone-800/60 px-2 py-1 rounded-full">
                Subiendo...
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-violet-400 flex flex-col items-center justify-center gap-1 text-stone-400 hover:text-violet-500 transition disabled:opacity-50"
        >
          <span className="text-2xl">+</span>
          <span className="text-xs font-medium">Foto</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleArchivo}
      />
    </div>
  );
}
