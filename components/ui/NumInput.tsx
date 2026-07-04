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
 *
 * Fuerza step="any": son campos de decimales libres. Con un step fijo (ej. 0.5)
 * un valor que no caiga justo en el paso (ej. 11.8 traído de producción) dispara
 * la validación nativa de HTML y bloquea el submit del formulario.
 */
export function NumInput({ value, onChange, onFocus, onWheel, step: _step, ...rest }: NumInputProps) {
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
      step="any"
      value={buf}
      onChange={(e) => { setBuf(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
      onFocus={(e) => { e.currentTarget.select(); onFocus?.(e); }}
      // Evita que girar la ruedita del mouse cambie el número: al hacer scroll, se
      // quita el foco y la página scrollea normal (no se modifica el valor).
      onWheel={(e) => { e.currentTarget.blur(); onWheel?.(e); }}
    />
  );
}
