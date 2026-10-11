"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"

export function useListParams<K extends string>(keys: readonly K[]) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const values = useMemo(
    () =>
      Object.fromEntries(
        keys.map((key) => [key, searchParams.get(key) ?? ""])
      ) as Record<K, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys là hằng số của trang
    [searchParams]
  )
  const page = Math.max(1, Number(searchParams.get("page")) || 1)

  const write = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [router, pathname]
  )

  const set = useCallback(
    (patch: Partial<Record<K, string>>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch) as [
        string,
        string | undefined,
      ][]) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      next.delete("page")
      write(next)
    },
    [searchParams, write]
  )

  const setPage = useCallback(
    (nextPage: number) => {
      const next = new URLSearchParams(searchParams.toString())
      if (nextPage > 1) next.set("page", String(nextPage))
      else next.delete("page")
      write(next)
    },
    [searchParams, write]
  )

  return { values, page, set, setPage }
}
