"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  key: string
  header: string
  className?: string
  cell: (row: T) => React.ReactNode
}

const SKELETON_ROWS = 5

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  onRowClick,
  empty,
}: {
  columns: DataTableColumn<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  isLoading: boolean
  error: unknown
  onRetry: () => void
  onRowClick?: (row: T) => void
  empty: string
}) {
  const colSpan = columns.length

  let body: React.ReactNode
  if (isLoading) {
    body = Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <tr
        key={index}
        data-testid="data-table-skeleton"
        className="border-t border-border/70"
      >
        {columns.map((column) => (
          <td key={column.key} className="px-3 py-4 first:pl-5">
            <span className="block h-4 w-full max-w-40 animate-pulse rounded bg-muted" />
          </td>
        ))}
      </tr>
    ))
  } else if (error) {
    body = (
      <tr className="border-t border-border/70">
        <td colSpan={colSpan} className="px-5 py-10 text-center">
          <p role="alert" className="text-[13px] text-muted-foreground">
            Không tải được dữ liệu.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onRetry}
          >
            Thử lại
          </Button>
        </td>
      </tr>
    )
  } else if (!rows || rows.length === 0) {
    body = (
      <tr className="border-t border-border/70">
        <td
          colSpan={colSpan}
          className="px-5 py-10 text-center text-[13px] text-muted-foreground"
        >
          {empty}
        </td>
      </tr>
    )
  } else {
    body = rows.map((row) => (
      <tr
        key={rowKey(row)}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        onKeyDown={
          onRowClick
            ? (event) => {
                if (
                  event.key === "Enter" &&
                  event.target === event.currentTarget
                ) {
                  event.preventDefault()
                  onRowClick(row)
                }
              }
            : undefined
        }
        className={cn(
          "border-t border-border/70 hover:bg-muted/35",
          onRowClick &&
            "cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
        )}
      >
        {columns.map((column) => (
          <td
            key={column.key}
            className={cn("px-3 py-3.5 first:pl-5", column.className)}
          >
            {column.cell(row)}
          </td>
        ))}
      </tr>
    ))
  }

  return (
    <div className="overflow-x-auto">
      <table
        aria-busy={isLoading || undefined}
        className="w-full text-left text-[13px]"
      >
        <thead className="bg-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-3 font-semibold whitespace-nowrap first:pl-5",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  )
}
