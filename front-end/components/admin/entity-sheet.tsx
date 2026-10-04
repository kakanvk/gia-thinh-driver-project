"use client"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function EntitySheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Lưu",
  submitting = false,
  onSubmit,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel?: string
  submitting?: boolean
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const header = (
    <SheetHeader className="border-b border-border/70 pr-12">
      <SheetTitle className="font-semibold text-navy">{title}</SheetTitle>
      {description ? <SheetDescription>{description}</SheetDescription> : null}
    </SheetHeader>
  )
  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
      {children}
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {onSubmit ? (
          <form
            noValidate
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            {header}
            <div className="flex min-h-0 flex-1 flex-col py-4">{body}</div>
            <SheetFooter className="flex-row justify-end border-t border-border/70">
              {footer}
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Huỷ
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitLabel}
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <>
            {header}
            <div className="flex min-h-0 flex-1 flex-col py-4">{body}</div>
            {footer ? (
              <SheetFooter className="flex-row justify-end border-t border-border/70">
                {footer}
              </SheetFooter>
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
