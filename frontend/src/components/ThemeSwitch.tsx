import { Languages, Laptop, Moon, Sun, Users } from 'lucide-react'
import { ReactNode } from 'react'

import { ThemeChoice, useTheme } from '../context/ThemeContext'
import { LanguageChoice, MESSAGES, useI18n } from '../i18n'

/** A small segmented control (radio group), as used for theme and language. */
function Segmented<T extends string>({ label, value, options, onChange }: {
  label   : string
  value   : T
  options : { value: T; label: string; icon: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] text-slate-500 dark:text-slate-400">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-lg bg-surface p-0.5 dark:bg-surface-dark">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12px] transition ${value === o.value
              ? 'bg-surface-card font-semibold shadow-sm dark:bg-surface-card-dark'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <span aria-hidden="true">{o.icon}</span>{o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Theme (System / Light / Dark) and language (Team / English / Português), in the account menu. */
export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const { t, choice, setChoice, teamLanguage } = useI18n()

  return (
    <div className="space-y-2.5">
      <Segmented<ThemeChoice>
        label={t.header.theme}
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'system', label: t.header.themeSystem, icon: <Laptop size={13} /> },
          { value: 'light', label: t.header.themeLight, icon: <Sun size={13} /> },
          { value: 'dark', label: t.header.themeDark, icon: <Moon size={13} /> },
        ]}
      />
      <Segmented<LanguageChoice>
        label={t.header.language}
        value={choice}
        onChange={setChoice}
        options={[
          { value: 'team', label: t.header.languageTeam(teamLanguage.toUpperCase()), icon: <Users size={13} /> },
          { value: 'en', label: MESSAGES.en.languageName, icon: <Languages size={13} /> },
          { value: 'pt', label: MESSAGES.pt.languageName, icon: <Languages size={13} /> },
        ]}
      />
    </div>
  )
}
