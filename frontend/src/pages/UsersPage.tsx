import { useCallback, useEffect, useState } from 'react'

import Header from '../components/Header'
import Toast from '../components/Toast'
import UserFormDialog from '../components/UserFormDialog'
import { useToast } from '../hooks/useToast'
import { ApiError, deleteUser, listUsers } from '../services/api'
import { useAuth, useUser } from '../context/AuthContext'
import type { User } from '../types'

export default function UsersPage() {
  const me = useUser()
  const { logout: onLogout } = useAuth()
  const [users, setUsers]     = useState<User[]>([])
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
    if (!confirm(`Delete user ${u.username}?\n\nTo keep the account but block access, edit it and untick "Active" instead.`)) return
    try {
      await deleteUser(u.id)
      toast.show(`${u.username} deleted.`)
      reload()
    } catch (err) {
      toast.show((err as Error).message)
    }
  }

  return (
    <>
      <Header>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => openForm(null)}>+ Add user</button>
      </Header>

      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        {error && <div className="mb-4 text-center text-sm text-warn dark:text-warn-dark">{error}</div>}
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[13px] text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-700/60">
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.name}{u.id === me.id && <span className="text-slate-400"> (you)</span>}</div>
                    <div className="text-[13px] text-slate-500 dark:text-slate-400">{u.username}</div>
                  </td>
                  <td className="px-4 py-2.5">{u.role === 'ADMIN' ? 'Admin' : 'Technician'}</td>
                  <td className={`px-4 py-2.5 ${u.active ? 'text-online dark:text-online-dark' : 'text-slate-400'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button className="btn mr-2" onClick={() => openForm(u)}>Edit</button>
                    {u.id !== me.id && <button className="btn text-danger dark:text-danger-dark" onClick={() => remove(u)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)}
                      onSaved={(msg) => { setFormOpen(false); toast.show(msg); reload() }} />
      <Toast message={toast.message} />
    </>
  )
}
