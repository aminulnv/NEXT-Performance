import { getCredentials } from './buildCache.mjs'
import { revolutLogin, revolutRequest } from './revolutHttp.mjs'
import { buildEmployeesByEmailFromList, mergeRevolutEmployeesDirectory } from './employeeLookup.mjs'

/** Live fetch of Revolut People directory (used for per-user sync). */
export async function fetchRevolutEmployeesByEmail() {
  const { email, token } = getCredentials()
  const sessionToken = await revolutLogin(email, token)
  const resp = await revolutRequest(sessionToken, '/employees', {
    page: 1,
    page_size: 1000,
  })
  const list = resp.results ?? resp.data ?? []
  const index = buildEmployeesByEmailFromList(list)
  mergeRevolutEmployeesDirectory(index)
  return { index, count: list.length }
}
