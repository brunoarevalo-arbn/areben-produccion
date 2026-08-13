'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { leerFichaMoldea, type FichaMoldea } from '@/lib/produccion/moldea';

// Pegar una tizada calculada por Moldea (el tizador propio, repo `areben-moldea`)
// en vez de tipear los metros a mano.
//
// 🔑 Prellena, no guarda. Los rollos se siguen eligiendo abajo, contra el
// inventario real, y el consumo lo registra el circuito de siempre al guardar la
// ficha. Moldea propone; el taller confirma.
//
// La confirmación NO es un trámite: es la única barrera contra el modo de falla
// del tizador, que es silencioso (una escala mal leída, una etiqueta que no se
// pudo atribuir). Por eso se muestra con qué ancho se corrió y no se puede
// aplicar con avisos sin tildarlos.

export function PegarDeMoldea({ onAplicar }: { onAplicar: (f: FichaMoldea) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [ficha, setFicha] = useState<FichaMoldea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leidos, setLeidos] = useState(false);

  const cerrar = () => {
    setAbierto(false); setTexto(''); setFicha(null); setError(null); setLeidos(false);
  };

  const revisar = (valor: string) => {
    setTexto(valor);
    setLeidos(false);
    if (!valor.trim()) { setFicha(null); setError(null); return; }
    const r = leerFichaMoldea(valor);
    if (r.ok) { setFicha(r.ficha); setError(null); } else { setFicha(null); setError(r.error); }
  };

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:border-stone-400 transition ml-2">
        Pegar de Moldea
      </button>
    );
  }

  const c = ficha?.corrida;
  const puedeAplicar = !!ficha && (!ficha.revisar || leidos);

  return (
    // `w-full` para que, dentro de la fila de botones (flex-wrap), el panel caiga
    // en su propio renglón en vez de espicharse al lado de «+ Agregar tizada».
    <div className="w-full border border-amber-200 bg-amber-50 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-stone-800">Pegar tizada de Moldea</h4>
        <button type="button" onClick={cerrar} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
      </div>
      <p className="text-xs text-stone-500 mb-3">
        Corré <code className="bg-white px-1 py-0.5 rounded border border-stone-200">node bin/tizar.js &lt;molde&gt;.dxf --ancho N --json</code> y
        pegá acá el contenido de <code className="bg-white px-1 py-0.5 rounded border border-stone-200">salida/&lt;molde&gt;-ficha.json</code>.
        Los rollos los seguís eligiendo vos, abajo.
      </p>

      <textarea value={texto} onChange={(e) => revisar(e.target.value)} rows={5}
        placeholder='{ "moldea": 1, "tizadas": [ … ] }'
        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-400 bg-white" />

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {ficha && (
        <div className="mt-3 bg-white border border-stone-200 rounded-lg p-3">
          {ficha.tizadas.map((t, i) => (
            <div key={i} className="text-sm text-stone-700 mb-1">
              <strong>{t.nombre}</strong>: {t.metros} m para {t.unidades} u
              <span className="text-stone-400"> ⇒ {(parseFloat(t.metros) / parseInt(t.unidades, 10)).toFixed(3)} m por prenda</span>
            </div>
          ))}
          {c && (
            <div className="mt-2 pt-2 border-t border-stone-100 text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
              {/* El ancho va primero y en negrita: es el supuesto que más fácil
                  se rompe. La tizada se calculó para ESE rollo, y si el que se
                  elige abajo es más angosto, los metros se quedan cortos. */}
              {c.anchoRolloMm && <span>Calculada para un rollo de <strong className="text-stone-700">{c.anchoRolloMm} mm</strong></span>}
              {c.tela && <span>tela {c.tela}</span>}
              {typeof c.capas === 'number' && c.capas > 1 && <span>{c.capas} capas</span>}
              {typeof c.aprovechamiento === 'number' && <span>aprovechamiento {(c.aprovechamiento * 100).toFixed(1)} %</span>}
            </div>
          )}
        </div>
      )}

      {ficha && ficha.avisos.length > 0 && (
        <div className="mt-3 bg-white border border-amber-300 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-700 mb-1">Moldea avisa {ficha.avisos.length} cosa{ficha.avisos.length === 1 ? '' : 's'}:</p>
          <ul className="text-xs text-stone-600 list-disc pl-4 space-y-0.5">
            {ficha.avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
          <label className="flex items-start gap-2 mt-3 text-xs text-stone-700 cursor-pointer">
            <input type="checkbox" checked={leidos} onChange={(e) => setLeidos(e.target.checked)} className="mt-0.5 accent-amber-500" />
            <span>Los leí. Estos avisos no rompen nada solos — se ven en la mesa de corte.</span>
          </label>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <Button type="button" size="sm" disabled={!puedeAplicar}
          onClick={() => { if (ficha) { onAplicar(ficha); cerrar(); } }}>
          Aplicar al formulario
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={cerrar}>Cancelar</Button>
      </div>
    </div>
  );
}
