import { MuestrasClient } from '@/components/produccion/MuestrasClient';

export const dynamic = 'force-dynamic';

export default function MuestrasPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Producción</span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Muestras</h1>
        <p className="text-stone-500 text-sm mt-1">
          Registrá la tela que se retira del stock para hacer una muestra. Se descuenta del rollo elegido.
        </p>
      </div>
      <MuestrasClient />
    </div>
  );
}
