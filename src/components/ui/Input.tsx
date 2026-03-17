import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full rounded-xl border px-4 py-3 text-sm text-brand-text placeholder-brand-slate/50
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary
          disabled:bg-brand-secondary disabled:text-brand-slate disabled:cursor-not-allowed
          ${error ? 'border-red-400 bg-red-50 focus:ring-red-400/30' : 'border-brand-border bg-white'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-xs font-medium text-red-600 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm leading-none">error</span>
          {error}
        </p>
      )}
    </div>
  )
}
