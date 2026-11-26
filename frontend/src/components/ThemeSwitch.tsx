import { Laptop, Moon, Sun } from 'lucide-react'

import { ThemeChoice, useTheme } from '../context/ThemeContext'

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Laptop },
  { value: 'light',  label: 'Light',  icon: Sun },
  { value: 'dark',   label: 'Dark',   icon: Moon },
]

/** Three-way theme switch (System / Light / Dark), shown in the account menu. */
export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <div className="mb-1.5 text-[12px] text-slate-500 dark:text-slate-400" id="theme-label">Theme</div>
      <div role="radiogroup" aria-labelledby="theme-label" className="flex gap-0.5 rounded-lg bg-surface p-0.5 dark:bg-surface-dark">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => setTheme(value)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[12px] transition ${theme === value
              ? 'bg-surface-card font-semibold shadow-sm dark:bg-surface-card-dark'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <Icon size={13} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
    </div>
  )
}
