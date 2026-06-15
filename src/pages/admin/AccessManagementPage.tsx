import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchAccessConfig,
  fetchDepartmentOptions,
  lookupEmployeeByEmail,
  removeAccessUser,
  saveAccessUser,
  syncAccessUserWithRevolut,
  uploadAccessUsersCsv,
  type AccessConfigResponse,
  type AccessRoleDefinition,
  type AccessUser,
} from '@/lib/accessApi'
import { downloadAccessUsersTemplate } from '@/lib/accessCsvTemplate'
import { Plus, Upload, Download, Users, RefreshCw } from 'lucide-react'
import {
  isValidScopedDepartmentSelection,
  normalizeScopedDepartments,
} from '@/lib/departmentScope'
import {
  DATA_ACCESS_LABELS,
  roleUsesDepartmentScope,
  slugifyRoleId,
  type DataAccess,
  type Role,
  type PermissionsConfig,
} from '@/lib/permissions'
import { savePermissions } from '@/lib/permissionsApi'
import { usePermissions } from '@/contexts/PermissionsContext'
import { LoadingState } from '@/components/performance/LoadingState'
import { DepartmentMultiSelect } from '@/components/admin/DepartmentMultiSelect'
import '@/styles/performance.css'

type EditableUserRow = {
  key: string
  isNew: boolean
  email: string
  name: string
  role: Role
  employeeId: string
  scopedDepartments: string[]
}

type EditableRoleRow = {
  key: string
  isNew: boolean
  roleId: string
  label: string
  dataAccess: DataAccess
  system: boolean
}

function usersToRows(users: AccessUser[]): EditableUserRow[] {
  return users.map((u) => ({
    key: u.email,
    isNew: false,
    email: u.email,
    name: u.name ?? '',
    role: u.role,
    employeeId: u.employeeId ?? '',
    scopedDepartments: u.scopedDepartments ?? [],
  }))
}

function emptyNewRow(defaultRole: Role): EditableUserRow {
  return {
    key: `new-${Date.now()}`,
    isNew: true,
    email: '',
    name: '',
    role: defaultRole,
    employeeId: '',
    scopedDepartments: [],
  }
}

function rowsFromUsers(users: AccessUser[], defaultRole: Role): EditableUserRow[] {
  return [...usersToRows(users), emptyNewRow(defaultRole)]
}

function defaultAssignRole(roles: AccessRoleDefinition[]): Role {
  return (
    roles.find((r) => r.id === 'manager')?.id ??
    roles.find((r) => !r.manageUsers)?.id ??
    roles[0]?.id ??
    'manager'
  )
}

function draftFromAccess(data: AccessConfigResponse): PermissionsConfig {
  return {
    pages: data.pages,
    roles: Object.fromEntries(
      data.roles.map((r) => [
        r.id,
        {
          label: r.label,
          description: r.description,
          pages: [...r.pages],
          system: r.system,
          manageUsers: r.manageUsers,
          dataAccess: r.dataAccess,
          uploadGoals: r.uploadGoals,
          forceRefresh: r.forceRefresh,
        },
      ]),
    ),
  }
}

function sortedRoleEntries(draft: PermissionsConfig) {
  return Object.entries(draft.roles).sort(([a], [b]) => {
    if (a === 'admin') return -1
    if (b === 'admin') return 1
    return a.localeCompare(b)
  })
}

function rolesToRows(draft: PermissionsConfig): EditableRoleRow[] {
  return sortedRoleEntries(draft).map(([roleId, def]) => ({
    key: roleId,
    isNew: false,
    roleId,
    label: def.label,
    dataAccess: def.dataAccess ?? 'full',
    system: Boolean(def.system || def.manageUsers),
  }))
}

function emptyNewRoleRow(): EditableRoleRow {
  return {
    key: `new-role-${Date.now()}`,
    isNew: true,
    roleId: '',
    label: '',
    dataAccess: 'full',
    system: false,
  }
}

function rowsFromRoles(draft: PermissionsConfig): EditableRoleRow[] {
  return [...rolesToRows(draft), emptyNewRoleRow()]
}

export default function AccessManagementPage() {
  const { canManageUsers, user: currentUser } = useAuth()
  const { source: permissionsSource, refresh: refreshPermissions } = usePermissions()
  const [config, setConfig] = useState<AccessConfigResponse | null>(null)
  const [rows, setRows] = useState<EditableUserRow[]>([])
  const [roleRows, setRoleRows] = useState<EditableRoleRow[]>([])
  const [draftPermissions, setDraftPermissions] = useState<PermissionsConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [permSaving, setPermSaving] = useState(false)
  const [permMessage, setPermMessage] = useState<string | null>(null)
  const [roleSavingKey, setRoleSavingKey] = useState<string | null>(null)
  const [syncingKey, setSyncingKey] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, departments] = await Promise.all([
        fetchAccessConfig(),
        fetchDepartmentOptions().catch(() => ({ departments: [], employeeCount: 0 })),
      ])
      const draft = draftFromAccess(data)
      setConfig(data)
      setDraftPermissions(draft)
      setRows(rowsFromUsers(data.users, defaultAssignRole(data.roles)))
      setRoleRows(rowsFromRoles(draft))
      setDepartmentOptions(departments.departments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canManageUsers) reload()
    else setLoading(false)
  }, [canManageUsers, reload])

  const roleOptions = draftPermissions ? sortedRoleEntries(draftPermissions) : []
  const roleIdsList = roleOptions.map(([id]) => id).join(', ')

  function updateRoleRow(key: string, patch: Partial<EditableRoleRow>) {
    setRoleRows((prev) => {
      const current = prev.find((r) => r.key === key)
      if (current && !current.isNew) {
        updateDraftRole(current.roleId, {
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.dataAccess !== undefined ? { dataAccess: patch.dataAccess } : {}),
        })
      }
      return prev.map((r) => {
        if (r.key !== key) return r
        const next = { ...r, ...patch }
        if (r.isNew && patch.label !== undefined && patch.roleId === undefined && !r.roleId.trim()) {
          next.roleId = slugifyRoleId(patch.label)
        }
        return next
      })
    })
    setPermMessage(null)
  }

  function discardNewRoleRow(key: string) {
    setRoleRows((prev) => {
      const next = prev.filter((r) => r.key !== key)
      return next.some((r) => r.isNew) ? next : [...next, emptyNewRoleRow()]
    })
  }

  function addEmptyRoleRow() {
    setRoleRows((prev) => [...prev, emptyNewRoleRow()])
  }

  function saveRoleRow(row: EditableRoleRow) {
    const label = row.label.trim()
    const id = (row.roleId.trim() || slugifyRoleId(label)).toLowerCase()
    if (!label) {
      setError('Enter a role name before saving.')
      return
    }
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(id)) {
      setError('Role id must be lowercase letters, numbers, hyphens (e.g. people_ops).')
      return
    }
    if (row.isNew && draftPermissions?.roles[id]) {
      setError(`Role "${id}" already exists.`)
      return
    }

    setRoleSavingKey(row.key)
    setError(null)
    setDraftPermissions((prev) => {
      if (!prev) return prev
      const next = {
        ...prev,
        roles: {
          ...prev.roles,
          [id]: {
            label,
            description: prev.roles[id]?.description ?? '',
            pages: prev.roles[id]?.pages ?? ['home', 'account.profile'],
            dataAccess: row.dataAccess,
            system: prev.roles[id]?.system ?? false,
            manageUsers: prev.roles[id]?.manageUsers,
            uploadGoals: prev.roles[id]?.uploadGoals,
            forceRefresh: prev.roles[id]?.forceRefresh,
          },
        },
      }
      setRoleRows(rowsFromRoles(next))
      return next
    })
    setRoleSavingKey(null)
    setPermMessage(null)
  }

  function handleRemoveRole(row: EditableRoleRow) {
    if (row.isNew) {
      discardNewRoleRow(row.key)
      return
    }
    removeCustomRole(row.roleId)
  }

  function updateRow(key: string, patch: Partial<EditableUserRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function resolveEmployeeForRow(row: EditableUserRow) {
    const email = row.email.trim().toLowerCase()
    if (!email.includes('@')) return
    try {
      const result = await lookupEmployeeByEmail(email)
      if (!result.found || !result.employeeId) return
      updateRow(row.key, {
        employeeId: result.employeeId,
        ...(result.name && !row.name.trim() ? { name: result.name } : {}),
      })
    } catch {
      /* lookup optional — server fills on save */
    }
  }

  function addEmptyRow() {
    const defaultRole = config ? defaultAssignRole(config.roles) : 'manager'
    setRows((prev) => [...prev, emptyNewRow(defaultRole)])
  }

  function discardNewRow(key: string) {
    const defaultRole = config ? defaultAssignRole(config.roles) : 'manager'
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key)
      const hasNew = next.some((r) => r.isNew)
      return hasNew ? next : [...next, emptyNewRow(defaultRole)]
    })
  }

  async function saveRow(row: EditableUserRow) {
    const email = row.email.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setError('Enter a valid work email before saving.')
      return
    }
    if (!draftPermissions?.roles[row.role]) {
      setError(`Unknown role "${row.role}". Save roles first or pick another role.`)
      return
    }
    if (
      roleUsesDepartmentScope(row.role) &&
      !isValidScopedDepartmentSelection(row.scopedDepartments)
    ) {
      setError('HRBP users must have at least one assigned department.')
      return
    }

    setSavingKey(row.key)
    setError(null)
    try {
      await saveAccessUser({
        email,
        role: row.role,
        name: row.name.trim() || undefined,
        employeeId: row.employeeId.trim() || undefined,
        scopedDepartments: roleUsesDepartmentScope(row.role)
          ? normalizeScopedDepartments(row.scopedDepartments)
          : null,
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingKey(null)
    }
  }

  async function syncRowWithRevolut(row: EditableUserRow) {
    const email = row.email.trim().toLowerCase()
    if (!email.includes('@')) {
      setError('Enter a valid email before syncing with Revolut.')
      return
    }
    if (row.isNew) {
      setError('Save the user first, or use Save after entering their email.')
      return
    }

    setSyncingKey(row.key)
    setError(null)
    setSyncMessage(null)
    try {
      const result = await syncAccessUserWithRevolut(email)
      setSyncMessage(result.message)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revolut sync failed')
    } finally {
      setSyncingKey(null)
    }
  }

  async function handleRemove(row: EditableUserRow) {
    if (row.isNew) {
      discardNewRow(row.key)
      return
    }
    if (row.email === currentUser?.email) {
      setError('You cannot remove your own account while logged in.')
      return
    }
    if (!window.confirm(`Remove access for ${row.email}?`)) return
    setError(null)
    try {
      await removeAccessUser(row.email)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  async function handleBulkCsv(file: File | undefined) {
    if (!file || bulkUploading) return
    setBulkUploading(true)
    setBulkMessage(null)
    setError(null)
    try {
      const text = await file.text()
      const result = await uploadAccessUsersCsv(text)
      setBulkMessage(
        `Imported ${result.total} users (${result.added} new, ${result.updated} updated).`,
      )
      setConfig((c) => (c ? { ...c, users: result.users } : c))
      const defaultRole = config ? defaultAssignRole(config.roles) : 'manager'
      setRows(rowsFromUsers(result.users, defaultRole))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed')
    } finally {
      setBulkUploading(false)
    }
  }

  function updateDraftRole(roleId: Role, patch: Partial<PermissionsConfig['roles'][Role]>) {
    setDraftPermissions((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        roles: {
          ...prev.roles,
          [roleId]: { ...prev.roles[roleId], ...patch },
        },
      }
    })
    setPermMessage(null)
  }

  function removeCustomRole(roleId: Role) {
    const def = draftPermissions?.roles[roleId]
    if (!def) return
    if (def.system || def.manageUsers) {
      setError('Built-in roles cannot be removed.')
      return
    }
    const userCount = config?.users.filter((u) => u.role === roleId).length ?? 0
    if (userCount > 0) {
      setError(`Cannot remove "${roleId}" — ${userCount} user(s) still use this role.`)
      return
    }
    if (!window.confirm(`Remove role "${def.label}" (${roleId})?`)) return

    setDraftPermissions((prev) => {
      if (!prev) return prev
      const roles = { ...prev.roles }
      delete roles[roleId]
      const next = { ...prev, roles }
      setRoleRows(rowsFromRoles(next))
      return next
    })
    setPermMessage(null)
  }

  function roleHasDraftPage(role: Role, pageKey: string): boolean {
    const pages = draftPermissions?.roles[role]?.pages
    if (!pages) return false
    if (pages.includes('*')) return true
    return pages.includes(pageKey)
  }

  function toggleDraftPage(role: Role, pageKey: string) {
    if (role === 'admin') return
    setDraftPermissions((prev) => {
      if (!prev) return prev
      const roleDef = prev.roles[role]
      if (!roleDef) return prev
      const pages = [...roleDef.pages]
      const idx = pages.indexOf(pageKey)
      if (idx >= 0) pages.splice(idx, 1)
      else pages.push(pageKey)
      return {
        ...prev,
        roles: {
          ...prev.roles,
          [role]: { ...roleDef, pages },
        },
      }
    })
    setPermMessage(null)
  }

  async function savePermissionsDraft() {
    if (!draftPermissions) return
    setPermSaving(true)
    setPermMessage(null)
    setError(null)
    try {
      const roles = { ...draftPermissions.roles }
      if (roles.admin) {
        roles.admin = { ...roles.admin, pages: ['*'], manageUsers: true, system: true }
      }
      const result = await savePermissions({
        pages: draftPermissions.pages,
        roles,
      })
      await refreshPermissions()
      await reload()
      setPermMessage(
        `Roles and page access saved (${result.source === 'supabase' ? 'Supabase' : 'file on server'}). Users may need to refresh.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setPermSaving(false)
    }
  }

  if (!canManageUsers) {
    return (
      <div className="pd-page">
        <div className="pd-alert">Only administrators can manage users.</div>
      </div>
    )
  }

  if (loading) return <LoadingState />

  const roleLabel = (id: Role) => draftPermissions?.roles[id]?.label ?? id
  const savedCount = rows.filter((r) => !r.isNew).length

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">
            <Users size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            User management
          </h1>
          <p className="pd-page-subtitle">
            Manage who can sign in, their roles, and page access
            {config?.storage ? ` · Users stored in ${config.storage}` : ''}
          </p>
          {config?.storage === 'file' && config.storageHint ? (
            <div className="pd-alert pd-alert-info" style={{ marginTop: '0.75rem' }}>
              {config.storageHint}
            </div>
          ) : null}
          {config?.storage === 'file' && !config.storageHint ? (
            <div className="pd-alert pd-alert-info" style={{ marginTop: '0.75rem' }}>
              Users are saved to a local file. Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to{' '}
              <code>.env</code> and restart <code>npm run dev</code> to use Supabase instead.
            </div>
          ) : null}
        </div>
        <button type="button" className="pd-btn-secondary pd-btn" onClick={addEmptyRow}>
          <Plus size={15} aria-hidden />
          Add user row
        </button>
      </header>

      {error ? <div className="pd-alert">{error}</div> : null}

      <section className="pd-panel" style={{ marginBottom: '1.5rem' }}>
        <h2 className="pd-panel-title">Users ({savedCount})</h2>
        <p className="pd-page-subtitle" style={{ marginBottom: '0.75rem' }}>
          Edit rows to update users, or fill the blank row at the bottom to add someone new.
          Revolut IDs auto-fill on save when possible. Edit manually if needed, or use{' '}
          <strong>Sync</strong> to fetch the latest match from Revolut for that user.
          HRBP users must be assigned one or more departments.
        </p>
        {syncMessage ? <p className="pd-upload-meta">{syncMessage}</p> : null}
        <div className="pd-table-wrap">
          <table className="pd-table pd-table--users-edit">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Departments</th>
                <th>Revolut ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelf = !row.isNew && row.email === currentUser?.email
                const isSaving = savingKey === row.key
                const isSyncing = syncingKey === row.key
                const rowBusy = isSaving || isSyncing
                return (
                  <tr key={row.key} className={row.isNew ? 'pd-table-row--new' : undefined}>
                    <td>
                      {row.isNew ? (
                        <input
                          type="email"
                          value={row.email}
                          onChange={(e) => updateRow(row.key, { email: e.target.value })}
                          onBlur={() => void resolveEmployeeForRow(row)}
                          className="pd-access-inline-input pd-access-inline-input--email"
                          placeholder="name@nextventures.io"
                          disabled={rowBusy}
                        />
                      ) : (
                        row.email
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.key, { name: e.target.value })}
                        className="pd-access-inline-input"
                        placeholder="Display name"
                        disabled={rowBusy}
                      />
                    </td>
                    <td>
                      <select
                        value={row.role}
                        onChange={(e) => {
                          const nextRole = e.target.value as Role
                          updateRow(row.key, {
                            role: nextRole,
                            ...(roleUsesDepartmentScope(nextRole)
                              ? {}
                              : { scopedDepartments: [] }),
                          })
                        }}
                        className="pd-access-inline-select"
                        disabled={rowBusy}
                      >
                        {roleOptions.map(([id]) => (
                          <option key={id} value={id}>
                            {roleLabel(id)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="pd-table-cell--departments">
                      {roleUsesDepartmentScope(row.role) ? (
                        <DepartmentMultiSelect
                          id={`departments-${row.key}`}
                          departments={departmentOptions}
                          selected={row.scopedDepartments}
                          includeAllDepartmentsOption
                          onChange={(scopedDepartments) =>
                            updateRow(row.key, {
                              scopedDepartments:
                                normalizeScopedDepartments(scopedDepartments) ?? [],
                            })
                          }
                          disabled={rowBusy}
                        />
                      ) : (
                        <span className="pd-muted">—</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.employeeId}
                        onChange={(e) => updateRow(row.key, { employeeId: e.target.value })}
                        className="pd-access-inline-input"
                        placeholder="Auto or manual"
                        disabled={rowBusy}
                      />
                    </td>
                    <td className="pd-table-actions pd-table-actions--wrap">
                      <button
                        type="button"
                        className="pd-btn pd-btn--sm"
                        disabled={rowBusy}
                        onClick={() => void saveRow(row)}
                      >
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      {!row.isNew ? (
                        <button
                          type="button"
                          className="pd-btn-secondary pd-btn pd-btn--sm"
                          disabled={rowBusy}
                          title="Fetch latest employee match from Revolut People"
                          onClick={() => void syncRowWithRevolut(row)}
                        >
                          <RefreshCw
                            size={14}
                            aria-hidden
                            className={isSyncing ? 'pd-icon-spin' : undefined}
                          />
                          {isSyncing ? 'Syncing…' : 'Sync'}
                        </button>
                      ) : null}
                      {row.isNew ? (
                        <button
                          type="button"
                          className="pd-btn-secondary pd-btn pd-btn--sm"
                          disabled={rowBusy}
                          onClick={() => discardNewRow(row.key)}
                        >
                          Clear
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pd-btn-secondary pd-btn pd-btn--sm"
                          disabled={isSelf || rowBusy}
                          title={isSelf ? 'Cannot remove yourself' : undefined}
                          onClick={() => void handleRemove(row)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pd-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="pd-section-header">
          <div>
            <h2 className="pd-panel-title">Roles</h2>
            <p className="pd-page-subtitle" style={{ marginBottom: 0 }}>
              Edit rows or use the blank row to add a role. Built-in roles cannot be removed.
              Click <strong>Save roles &amp; page access</strong> below to apply.
            </p>
          </div>
          <button type="button" className="pd-btn-secondary pd-btn" onClick={addEmptyRoleRow}>
            <Plus size={15} aria-hidden />
            Add row
          </button>
        </div>
        <div className="pd-table-wrap" style={{ marginTop: '0.75rem' }}>
          <table className="pd-table pd-table--users-edit">
            <thead>
              <tr>
                <th>Role id</th>
                <th>Name</th>
                <th>Data access</th>
                <th>Users</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roleRows.map((row) => {
                const userCount =
                  config?.users.filter((u) => u.role === row.roleId).length ?? 0
                const isSaving = roleSavingKey === row.key
                const isAdmin = !row.isNew && row.roleId === 'admin'
                const canRemove = !row.isNew && !row.system
                return (
                  <tr key={row.key} className={row.isNew ? 'pd-table-row--new' : undefined}>
                    <td>
                      {row.isNew ? (
                        <input
                          type="text"
                          className="pd-access-inline-input"
                          value={row.roleId}
                          placeholder="people_ops"
                          disabled={isSaving || permSaving}
                          onChange={(e) =>
                            updateRoleRow(row.key, {
                              roleId: e.target.value.toLowerCase(),
                            })
                          }
                        />
                      ) : (
                        <code>{row.roleId}</code>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="pd-access-inline-input"
                        value={row.label}
                        placeholder="e.g. People Ops"
                        disabled={isAdmin || isSaving || permSaving}
                        onChange={(e) => updateRoleRow(row.key, { label: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="pd-access-inline-select"
                        value={row.dataAccess}
                        disabled={isAdmin || isSaving || permSaving}
                        onChange={(e) =>
                          updateRoleRow(row.key, {
                            dataAccess: e.target.value as DataAccess,
                          })
                        }
                      >
                        {(Object.keys(DATA_ACCESS_LABELS) as DataAccess[]).map((key) => (
                          <option key={key} value={key}>
                            {DATA_ACCESS_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{row.isNew ? '—' : userCount}</td>
                    <td className="pd-table-actions">
                      <button
                        type="button"
                        className="pd-btn pd-btn--sm"
                        disabled={isSaving || permSaving}
                        onClick={() => saveRoleRow(row)}
                      >
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      {row.isNew ? (
                        <button
                          type="button"
                          className="pd-btn-secondary pd-btn pd-btn--sm"
                          disabled={isSaving || permSaving}
                          onClick={() => discardNewRoleRow(row.key)}
                        >
                          Clear
                        </button>
                      ) : canRemove ? (
                        <button
                          type="button"
                          className="pd-btn-secondary pd-btn pd-btn--sm"
                          disabled={permSaving || userCount > 0}
                          title={
                            userCount > 0
                              ? 'Reassign users before removing this role'
                              : undefined
                          }
                          onClick={() => handleRemoveRole(row)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pd-panel" style={{ marginBottom: '1.5rem' }}>
        <h2 className="pd-panel-title">Bulk import</h2>
        <p className="pd-page-subtitle" style={{ marginBottom: '0.75rem' }}>
          CSV columns: <code>email</code>, <code>role</code> (use role ids: {roleIdsList}).
          Optional: <code>name</code> (<code>employee_id</code> is filled from Revolut when omitted).
        </p>
        <div className="pd-upload-actions" style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="pd-btn-secondary pd-btn" onClick={downloadAccessUsersTemplate}>
            <Download size={15} aria-hidden />
            Download template
          </button>
        </div>
        <div className="pd-upload pd-upload--compact">
          <input
            id="access-csv-upload"
            type="file"
            accept=".csv,text/csv"
            className="pd-upload-input"
            disabled={bulkUploading}
            onChange={(e) => void handleBulkCsv(e.target.files?.[0])}
          />
          <label
            htmlFor="access-csv-upload"
            className={`pd-upload-btn${bulkUploading ? ' pd-upload-btn--loading' : ''}`}
          >
            <Upload size={15} aria-hidden />
            {bulkUploading ? 'Importing…' : 'Upload users CSV'}
          </label>
        </div>
        {bulkMessage ? <p className="pd-upload-meta">{bulkMessage}</p> : null}
      </section>

      <section className="pd-panel">
        <h2 className="pd-panel-title">Pages by role</h2>
        <p className="pd-page-subtitle" style={{ marginBottom: '0.75rem' }}>
          Choose which pages each role can open. Stored in{' '}
          {permissionsSource === 'supabase' ? 'Supabase' : 'server file'} with roles.
          Administrator always has all pages.
        </p>
        {permMessage ? <p className="pd-upload-meta">{permMessage}</p> : null}
        <div className="pd-table-wrap">
          <table className="pd-table pd-table--compact pd-table--perm">
            <thead>
              <tr>
                <th>Page</th>
                {draftPermissions &&
                  roleOptions.map(([roleId, def]) => (
                    <th key={roleId}>{def.label}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {draftPermissions &&
                Object.entries(draftPermissions.pages)
                  .sort(([, a], [, b]) =>
                    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
                  )
                  .map(([pageKey, meta]) => (
                  <tr key={pageKey}>
                    <td>{meta.label}</td>
                    {roleOptions.map(([roleId]) => {
                      const isAdmin = roleId === 'admin'
                      const checked = roleHasDraftPage(roleId, pageKey)
                      return (
                        <td key={roleId} className="pd-perm-cell">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isAdmin || permSaving}
                            title={isAdmin ? 'Administrator has all pages' : undefined}
                            aria-label={`${roleLabel(roleId)}: ${meta.label}`}
                            onChange={() => toggleDraftPage(roleId, pageKey)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="pd-upload-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="pd-btn"
            disabled={permSaving || !draftPermissions}
            onClick={() => void savePermissionsDraft()}
          >
            {permSaving ? 'Saving…' : 'Save roles & page access'}
          </button>
        </div>
      </section>
    </div>
  )
}
