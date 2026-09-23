import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// --- Attach access token to every request ---
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { access } = useAuthStore.getState()
  if (access) {
    config.headers.Authorization = `Bearer ${access}`
  }
  return config
})

// --- Auto-refresh on 401 ---
let isRefreshing = false
let pendingQueue: Array<(token: string | null) => void> = []

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = useAuthStore.getState()
  if (!refresh) return null

  try {
    const res = await axios.post(`${API_URL}/api/core/auth/refresh/`, { refresh })
    const newAccess = res.data.access as string
    useAuthStore.getState().setAccess(newAccess)
    return newAccess
  } catch {
    useAuthStore.getState().clear()
    return null
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status

    if (status === 401 && !original._retry) {
      original._retry = true

      if (isRefreshing) {
        // Wait for the current refresh to finish
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (!token) return reject(error)
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }

      isRefreshing = true
      const newToken = await refreshAccessToken()
      isRefreshing = false
      pendingQueue.forEach((cb) => cb(newToken))
      pendingQueue = []

      if (!newToken) return Promise.reject(error)
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    }

    return Promise.reject(error)
  },
)

// --- Download helper: fetch as blob so JWT is sent ---
export async function downloadFile(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const blob = new Blob([res.data])
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}