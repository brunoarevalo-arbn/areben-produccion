import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  hint,
  fullWidth = false,
  className = '',
  ...props
}: InputProps) {
  const baseClasses = 'border border-stone-200 rounded-xl px-4 py-2 text-base text-stone-900 placeholder-stone-400 transition-colors focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:bg-stone-50 disabled:cursor-not-allowed';

  const inputClasses = error
    ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20'
    : baseClasses;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-stone-700 mb-2">
          {label}
        </label>
      )}
      <input
        className={`${inputClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-stone-500 mt-1">{hint}</p>
      )}
    </div>
  );
}
