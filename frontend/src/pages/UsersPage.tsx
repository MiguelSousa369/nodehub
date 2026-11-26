import { Globe, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Banner, ListSkeleton } from '../components/Feedback'
import Header from '../components/Header'
import Toast from '../components/Toast'
import UserFormDialog from '../components/UserFormDialog'
import { useAuth, useUser } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { Language, MESSAGES, useI18n } from '../i18n'
import { ApiError, deleteUser, listUsers, updateSettings } from '../services/api'
import type { User } from '../types'

// ---------------------------------------------------------------------------
// Admins only: team settings (language) and the user list.
// ---------------------------------------------------------------------------

/** Team language: what Claude writes records in, the CLI and installer language, and everyone's default. */
function TeamSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const { t, teamLanguage, setTeamLanguage } = useI18n()
  const [error, setError] = useState<string | null>(null)

  async function change(language: Language) {
    try {
      const saved = await updateSettings({ language })
      setTeamLanguage(saved.language)
      setError(null)
      onSaved(MESSAGES[saved.language].users.teamSaved)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="card mb-5 p-5" aria-labelledby="team-title">
      <h2 id="team-title" className="mb-3 flex items-center gap-2 font-semibold">
        <Globe size={16} aria-hidden="true" className="text-slate-400" />{t.users.teamTitle}
      </h2>
      <label className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{t.users.teamLanguage}</span>
        <select className="input w-auto" value={teamLanguage} onChange={(e) => change(e.target.value as Language)}>
          {(Object.keys(MESSAGES) as Language[]).map((l) => <option key={l} value={l}>{MESSAGES[l].languageName}</option>)}
        </select>
      </label>
      <p className="mt-2 max-w-2xl text-[13px] text-slate-500 dark:text-slate-400">{t.users.teamHelp}</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger dark:text-danger-dark">{error}</p>}
    </section>
  )
}

export default function UsersPage() {
  const me = useUser()
  const { logout: onLogout } = useAuth()
  const { t } = useI18n()
  const [users, setUsers]     = useState<User[] | null>(null)   // null while loading
  const [error, setError]     = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const toast = useToast()

  const reload = useCallback(async () => {
    try {
      setUsers(await listUsers())
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return onLogout()
      setError((err as Error).message)
    }
  }, [onLogout])

  useEffect(() => { reload() }, [reload])

  function openForm(u: User | null) {
    setEditing(u)
    setFormOpen(true)
  }

  async function remove(u: User) {
    if (!confirm(t.users.deleteConfirm(u.username))) return
    try {
      await deleteUser(u.id)
      toast.show(t.users.deleted(u.username))
      reload()
    } catch (err) {
      toast.show((err as Error).message)
    }
  }

  return (
    <>
      <Header>
        <div className="flex-1" />
        <button className="btn-primary gap-1.5" onClick={() => openForm(null)}><Plus size={16} aria-hidden="true" />{t.users.addUser}</button>
      </Header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-5 outline-none sm:px-6">
        <TeamSettings onSaved={toast.show} />

        {error && <Banner>{error}</Banner>}
        {!users && !error && <ListSkeleton rows={3} label={t.users.loading} />}
        {users && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[13px] text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700/60">
                  <th className="px-4 py-2.5 font-medium">{t.users.user}</th>
                  <th className="px-4 py-2.5 font-medium">{t.users.role}</th>
                  <th className="px-4 py-2.5 font-medium">{t.users.status}</th>
                  <th className="px-4 py-2.5"><span className="sr-only">{t.users.actions}</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">
                        {u.name}{u.id === me.id && <span className="font-normal text-slate-500 dark:text-slate-400"> {t.users.you}</span>}
                      </div>
                      <div className="text-[13px] text-slate-500 dark:text-slate-400">{u.username}</div>
                    </td>
                    <td className="px-4 py-2.5">{u.role === 'ADMIN' ? t.common.admin : t.common.technician}</td>
                    <td className={`px-4 py-2.5 ${u.active ? 'text-online dark:text-online-dark' : 'text-slate-500 dark:text-slate-400'}`}>
                      {u.active ? t.users.active : t.users.inactive}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button className="btn mr-2" onClick={() => openForm(u)} aria-label={t.users.editUser(u.username)}>{t.common.edit}</button>
                      {u.id !== me.id && (
                        <button className="btn text-danger dark:text-danger-dark" onClick={() => remove(u)} aria-label={t.users.deleteUser(u.username)}>
                          {t.common.delete}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)}
                      onSaved={(msg) => { setFormOpen(false); toast.show(msg); reload() }} />
      <Toast message={toast.message} />
    </>
  )
}
