import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

// Checkbox estándar: accent ámbar + label clickeable. Reemplaza los
// `<input type="checkbox" className="rounded border-stone-300">` crudos.
export function Checkbox({ label, className = '', ...props }: CheckboxProps) {
  const input = (
    <input
      type="checkbox"
      className={`rounded border-stone-300 accent-amber-500 ${className}`}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
      {input}
      {label}
    </label>
  );
}
