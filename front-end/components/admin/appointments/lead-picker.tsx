"use client"

import { useQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"

import type { FieldControlProps } from "@/components/admin/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Lead, Page } from "@/lib/admin/types"
import { apiFetch } from "@/lib/api/client"

export type LeadSummary = Pick<
  Lead,
  "id" | "code" | "name" | "phone" | "branchId"
>

const DEBOUNCE_MS = 300
const MIN_CHARS = 2
const LIMIT = 8

export function LeadPicker({
  value,
  onChange,
  ...control
}: {
  value: LeadSummary | null
  onChange: (lead: LeadSummary | null) => void
} & FieldControlProps) {
  const [text, setText] = useState("")
  const [term, setTerm] = useState("")

  useEffect(() => {
    const next = text.trim()
    const timer = setTimeout(() => setTerm(next), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  const query = { q: term, limit: LIMIT }
  const results = useQuery({
    queryKey: ["leads", query],
    queryFn: ({ signal }) => apiFetch<Page<Lead>>("/leads", { query, signal }),
    enabled: !value && term.length >= MIN_CHARS,
  })

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <span className="min-w-0 text-sm">
          <span className="block truncate font-semibold">{value.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {value.phone} · {value.code}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setText("")
            setTerm("")
            onChange(null)
          }}
        >
          <X aria-hidden="true" />
          Bỏ chọn
        </Button>
      </div>
    )
  }

  const searching = term.length >= MIN_CHARS
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          {...control}
          type="search"
          autoComplete="off"
          placeholder="Tìm theo tên, SĐT hoặc mã khách"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="pl-9"
        />
      </div>
      {searching ? (
        results.isPending ? (
          <p className="text-xs text-muted-foreground">Đang tìm…</p>
        ) : results.error ? (
          <p className="text-xs text-destructive">Không tìm được khách.</p>
        ) : results.data.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Không có khách nào khớp.
          </p>
        ) : (
          <ul
            aria-label="Kết quả tìm khách"
            className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-border"
          >
            {results.data.data.map((lead) => (
              <li
                key={lead.id}
                className="border-b border-border/60 last:border-0"
              >
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  onClick={() =>
                    onChange({
                      id: lead.id,
                      code: lead.code,
                      name: lead.name,
                      phone: lead.phone,
                      branchId: lead.branchId,
                    })
                  }
                >
                  <span className="text-sm font-semibold">{lead.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {lead.phone} · {lead.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Bỏ trống nếu lịch hẹn không gắn với khách cụ thể.
        </p>
      )}
    </div>
  )
}
