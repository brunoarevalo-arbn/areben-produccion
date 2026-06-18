'use client';

import { useState, useEffect, InputHTMLAttributes } from 'react';

type NumInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (n: number) => void;
};

/**
 * Input numérico reutilizable. Resuelve el "problema del 0":
 * - cuando el valor es 0 muestra vacío (no un 0 molesto que hay que borrar)
 * - selecciona todo el contenido al enfocar, así escribís encima directo
 * Mantiene un buffer de texto interno para poder tipear "0.5", "0.", etc. sin
 * que el número parseado pelee con lo que estás escribiendo.
 */
export function NumInput({ value, onChange, onFocus, ...rest }: NumInputProps) {
  const [buf, setBuf] = useState(value ? String(value) : '');

  // Sincroniza si el valor externo cambia por fuera de lo que se está tipeando
  // (reset de formulario, autocompletado desde producción, etc.)
  useEffect(() => {
    if ((parseFloat(buf) || 0) !== value) setBuf(value ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={buf}
      onChange={(e) => { setBuf(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
      onFocus={(e) => { e.currentTarget.select(); onFocus?.(e); }}
    />
  );
}
