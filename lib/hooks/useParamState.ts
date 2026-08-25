'use client';

// El estado de una lista (solapa, filtro, búsqueda, qué está desplegado) vive en la URL,
// no en un `useState` del componente. Motivo: cualquier ida a otra ruta —"Ver PDF", entrar
// a una OP, abrir un rollo— DESMONTA el componente, y al volver el `useState` arranca de
// cero. Con el valor en la query, el Atrás del navegador y un `← Volver` que conserve la
// query devuelven la pantalla tal como estaba.
//
// El default nunca se escribe en la URL (se borra la clave): así una lista sin tocar no
// deja rastro y los links quedan limpios.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

function useEscribir() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  return useCallback((key: string, valor: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (valor === null || valor === '') next.delete(key);
    else next.set(key, valor);
    const qs = next.toString();
    // `replace` y no `push`: cambiar de solapa no tiene que llenar el historial de Atrás.
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, params]);
}

/**
 * Valor de texto libre en la URL (solapa, filtro, select).
 * `NoInfer` en el default: sin eso, `useParamState('cat', '')` inferiría el tipo `''` y no
 * dejaría escribir ninguna otra cosa. Con esto, sin type-arg explícito el tipo es `string`,
 * y una unión cerrada se pide a mano: `useParamState<'a' | 'b'>('tab', 'a')`.
 */
export function useParamState<T extends string = string>(key: string, def: NoInfer<T>): [T, (v: T) => void] {
  const params   = useSearchParams();
  const escribir = useEscribir();
  const valor    = (params.get(key) as T | null) ?? def;
  const setValor = useCallback((v: T) => escribir(key, v === def ? null : v), [escribir, key, def]);
  return [valor, setValor];
}

/** Booleano: presente con '1' = true; ausente = false. */
export function useParamBool(key: string, def = false): [boolean, (v: boolean) => void] {
  const params   = useSearchParams();
  const escribir = useEscribir();
  const raw      = params.get(key);
  const valor    = raw === null ? def : raw === '1';
  const setValor = useCallback((v: boolean) => escribir(key, v === def ? null : (v ? '1' : '0')), [escribir, key, def]);
  return [valor, setValor];
}

/** Conjunto de ids (lotes desplegados, filas abiertas), serializado separado por comas. */
export function useParamSet(key: string): [Set<string>, (id: string) => void] {
  const params   = useSearchParams();
  const escribir = useEscribir();
  const raw      = params.get(key);
  const valor    = new Set(raw ? raw.split(',').filter(Boolean) : []);
  const toggle   = useCallback((id: string) => {
    const actual = new Set((params.get(key) ?? '').split(',').filter(Boolean));
    if (actual.has(id)) actual.delete(id); else actual.add(id);
    escribir(key, actual.size ? [...actual].join(',') : null);
  }, [escribir, key, params]);
  return [valor, toggle];
}

/**
 * Texto que se tipea (buscadores). El input responde al instante con un buffer local y la
 * URL se escribe recién cuando dejás de tipear: un `router.replace` por tecla haría
 * re-render de la ruta entera en cada letra.
 */
export function useParamTexto(key: string, delayMs = 350): [string, (v: string) => void] {
  const params    = useSearchParams();
  const escribir  = useEscribir();
  const enUrl     = params.get(key) ?? '';
  const [local, setLocal] = useState(enUrl);
  const tocado    = useRef(false);
  const timer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La URL cambió por afuera (Atrás, un link) y el usuario no está tipeando: seguirla.
  useEffect(() => { if (!tocado.current) setLocal(enUrl); }, [enUrl]);

  const setValor = useCallback((v: string) => {
    tocado.current = true;
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { tocado.current = false; escribir(key, v || null); }, delayMs);
  }, [escribir, key, delayMs]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return [local, setValor];
}

/** La URL actual con su query — para mandarla como `?volverA=` al detalle. */
export function useVolverA(): string {
  const pathname = usePathname();
  const params   = useSearchParams();
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
