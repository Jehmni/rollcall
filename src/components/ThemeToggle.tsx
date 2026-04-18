import { useTheme } from '../contexts/ThemeContext'

interface Props {
  className?: string
}

export function ThemeToggle({ className = '' }: Props) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className={`size-10 flex items-center justify-center rounded-full transition-colors
        bg-black/5 hover:bg-black/10 text-slate-600
        dark:bg-white/10 dark:hover:bg-white/20 dark:text-white
        ${className}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="material-symbols-outlined text-xl">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  )
}
