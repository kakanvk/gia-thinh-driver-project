"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { apiData, apiFetch } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import {
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from "@/lib/api/session"
import type { SessionUser } from "@/lib/auth/user"

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "offline"

type AuthState = {
  status: AuthStatus
  user: SessionUser | null
  permissions: string[]
  signedOut: boolean
}

type AuthContextValue = AuthState & {
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>
  setUser: (user: SessionUser) => void
  retry: () => void
}

type Me = { user: SessionUser; permissions: string[] }

const ANONYMOUS: AuthState = {
  status: "anonymous",
  user: null,
  permissions: [],
  signedOut: false,
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isUnreachable(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 0 || error.status >= 500)
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({
    ...ANONYMOUS,
    status: "loading",
  })

  const loadMe = useCallback(async () => {
    const me = await apiData<Me>("/auth/me")
    setState({
      status: "authenticated",
      user: me.user,
      permissions: me.permissions,
      signedOut: false,
    })
  }, [])

  // Mọi setState nằm trong callback của promise (không đồng bộ trong effect)
  const bootstrap = useCallback(
    () =>
      refreshSession()
        .then((session) => (session ? loadMe() : setState(ANONYMOUS)))
        .catch((error: unknown) =>
          setState(
            isUnreachable(error)
              ? { ...ANONYMOUS, status: "offline" }
              : ANONYMOUS
          )
        ),
    [loadMe]
  )

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear()
        setState(ANONYMOUS)
      }),
    [queryClient]
  )

  const login = useCallback(
    async (identifier: string, password: string) => {
      const session = await apiData<{ accessToken: string; user: SessionUser }>(
        "/auth/login",
        {
          method: "POST",
          body: { identifier, password },
        }
      )
      setAccessToken(session.accessToken)
      await loadMe()
    },
    [loadMe]
  )

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" })
    } catch {
      // Lỗi mạng vẫn đăng xuất phía trình duyệt
    }
    setAccessToken(null)
    queryClient.clear()
    setState({ ...ANONYMOUS, signedOut: true })
  }, [queryClient])

  const username = state.user?.username
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      })
      // Backend huỷ mọi refresh token (kể cả phiên này) → đăng nhập lại bằng mật khẩu mới
      try {
        await login(username ?? "", newPassword)
      } catch {
        await logout()
      }
    },
    [login, logout, username]
  )

  const setUser = useCallback((user: SessionUser) => {
    setState((current) => ({ ...current, user }))
  }, [])

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }))
    void bootstrap()
  }, [bootstrap])

  const value = useMemo(
    () => ({ ...state, login, logout, changePassword, setUser, retry }),
    [state, login, logout, changePassword, setUser, retry]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth phải nằm trong AuthProvider")
  return context
}
