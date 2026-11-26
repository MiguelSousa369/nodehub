import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { en, Messages } from './en'
import { pt } from './pt'

export type { Messages }

// ---------------------------------------------------------------------------
// Languages: English and Portuguese (Portugal).
//
//   team language   set by an admin (GET/PUT /api/settings). Default for everyone, and the language
//                   Claude writes records in. Cached in localStorage so the first paint is right.
//   personal choice "team" (default), "en" or "pt", per browser (localStorage "language").
//
// Non-React code (API errors, date helpers) reads the active language through getMessages() /
// getLanguage(), which the provider keeps up to date.
// ---------------------------------------------------------------------------

export type Language = 'en' | 'pt'
export type LanguageChoice = 'team' | Language

export const MESSAGES: Record<Language, Messages> = { en, pt }
export const LOCALES: Record<Language, string> = { en: 'en-GB', pt: 'pt-PT' }

const CHOICE_KEY = 'language'
const TEAM_KEY   = 'teamLanguage'

let active: Language = 'en'
export const getLanguage = (): Language => active
export const getMessages = (): Messages => MESSAGES[active]
export const getLocale   = (): string => LOCALES[active]

const isLanguage = (v: unknown): v is Language => v === 'en' || v === 'pt'

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* storage blocked: keeps working for this page */ }
}

interface I18nState {
  t           : Messages
  language    : Language          // the one in use
  locale      : string            // for dates and numbers
  choice      : LanguageChoice
  teamLanguage: Language
  setChoice   : (choice: LanguageChoice) => void
  /** After an admin changes the team language. */
  setTeamLanguage: (language: Language) => void
}

const I18nContext = createContext<I18nState | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [teamLanguage, setTeam] = useState<Language>(() => {
    const cached = read(TEAM_KEY)
    return isLanguage(cached) ? cached : 'en'
  })
  const [choice, setChoiceState] = useState<LanguageChoice>(() => {
    const saved = read(CHOICE_KEY)
    return isLanguage(saved) ? saved : 'team'
  })

  // Fetch the team language (public endpoint, so the login page is right too)
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s && isLanguage(s.language)) { setTeam(s.language); write(TEAM_KEY, s.language) } })
      .catch(() => { /* keep the cached value */ })
  }, [])

  const language: Language = choice === 'team' ? teamLanguage : choice
  active = language   // for non-React code; set during render so children already see it

  useEffect(() => { document.documentElement.lang = LOCALES[language] }, [language])

  const setChoice = useCallback((next: LanguageChoice) => {
    write(CHOICE_KEY, next === 'team' ? null : next)
    setChoiceState(next)
  }, [])

  const setTeamLanguage = useCallback((next: Language) => {
    write(TEAM_KEY, next)
    setTeam(next)
  }, [])

  const value = useMemo<I18nState>(() => ({
    t: MESSAGES[language], language, locale: LOCALES[language], choice, teamLanguage, setChoice, setTeamLanguage,
  }), [language, choice, teamLanguage, setChoice, setTeamLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
