"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (total <= limit) return null
  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <nav
      aria-label="Phân trang"
      className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3"
    >
      <p className="text-xs text-muted-foreground">
        Trang {page}/{pages} · {total} bản ghi
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Trước
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Sau
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
