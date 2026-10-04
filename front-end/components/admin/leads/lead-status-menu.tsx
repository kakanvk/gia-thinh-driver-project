"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { FormField } from "@/components/admin/form-field"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { LEAD_STATUS_LABELS } from "@/lib/admin/labels"
import { nextStatuses } from "@/lib/admin/lead-status"
import type { Lead, LeadStatus } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"

type StatusBody = { status: LeadStatus; lostReason?: string; note?: string }

export function LeadStatusMenu({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<LeadStatus | null>(null)
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const options = nextStatuses(lead.status)
  const isLost = target === "lost"

  const mutation = useMutation({
    mutationFn: (body: StatusBody) =>
      apiData<Lead>(`/leads/${lead.id}/status`, { method: "PATCH", body }),
    meta: { silent: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(["lead", saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      void queryClient.invalidateQueries({
        queryKey: ["lead-activities", saved.id],
      })
      toast.success(`Đã chuyển sang ${LEAD_STATUS_LABELS[saved.status]}`)
      setTarget(null)
    },
    onError: (err) => {
      const fields = err instanceof ApiError ? fieldErrors(err.details) : {}
      const message = fields.lostReason ?? fields.note
      if (message) setError(message)
      else toast.error(errorMessage(err))
    },
  })

  if (options.length === 0) return null

  function pick(status: LeadStatus) {
    setTarget(status)
    setText("")
    setError("")
  }

  function confirm() {
    if (!target) return
    const value = text.trim()
    if (isLost) {
      if (value.length < 3 || value.length > 300) {
        setError("Nhập lý do từ 3 đến 300 ký tự")
        return
      }
      mutation.mutate({ status: target, lostReason: value })
      return
    }
    mutation.mutate(value ? { status: target, note: value } : { status: target })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
          Đổi trạng thái
          <ChevronDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          {options.map((status) => (
            <DropdownMenuItem
              key={status}
              variant={status === "lost" ? "destructive" : "default"}
              onClick={() => pick(status)}
            >
              {LEAD_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        title={
          target ? `Chuyển sang "${LEAD_STATUS_LABELS[target]}"?` : "Đổi trạng thái"
        }
        description={
          isLost
            ? "Ghi rõ lý do khách không tiếp tục để tiện theo dõi."
            : `${lead.name} · ${lead.code}`
        }
        destructive={isLost}
        pending={mutation.isPending}
        onConfirm={confirm}
      >
        <FormField
          id="lead-status-text"
          label={isLost ? "Lý do" : "Ghi chú"}
          required={isLost}
          error={error}
        >
          <Textarea
            rows={3}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              if (error) setError("")
            }}
          />
        </FormField>
      </ConfirmDialog>
    </>
  )
}
