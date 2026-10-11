"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { nameById, useStaffOptions } from "@/lib/admin/lookups"
import type { Lead } from "@/lib/admin/types"
import { apiData } from "@/lib/api/client"

// Giá trị "chưa phân công" cho Select (Base UI không có item rỗng)
const NONE = "none"

export function LeadAssign({
  lead,
  canUpdate,
}: {
  lead: Lead
  canUpdate: boolean
}) {
  const queryClient = useQueryClient()
  const staff = useStaffOptions()

  const mutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      apiData<Lead>(`/leads/${lead.id}/assign`, {
        method: "PATCH",
        body: { assigneeId },
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["lead", saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      void queryClient.invalidateQueries({
        queryKey: ["lead-activities", saved.id],
      })
      toast.success(
        saved.assigneeId
          ? `Đã phân công cho ${nameById(staff.data, saved.assigneeId, "nhân viên")}`
          : "Đã bỏ phân công"
      )
    },
  })

  const assigneeName = nameById(staff.data, lead.assigneeId, "Nhân viên")
  if (!canUpdate) {
    return (
      <p className="text-sm">
        {lead.assigneeId ? (
          assigneeName
        ) : (
          <span className="text-muted-foreground">Chưa phân công</span>
        )}
      </p>
    )
  }

  const options = (staff.data ?? []).filter((option) =>
    option.branchIds.includes(lead.branchId)
  )
  const items = [
    { value: NONE, label: "Chưa phân công" },
    ...options.map((option) => ({ value: option.id, label: option.name })),
  ]
  // Người phụ trách hiện tại không còn trong danh sách (VD đã nghỉ): vẫn hiện tên
  if (lead.assigneeId && !options.some((o) => o.id === lead.assigneeId)) {
    items.push({ value: lead.assigneeId, label: assigneeName })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={items}
        value={lead.assigneeId ?? NONE}
        disabled={mutation.isPending}
        onValueChange={(value) => {
          const next = !value || value === NONE ? null : value
          if (next !== lead.assigneeId) mutation.mutate(next)
        }}
      >
        <SelectTrigger aria-label="Phân công" className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {lead.assigneeId ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(null)}
        >
          Bỏ phân công
        </Button>
      ) : null}
    </div>
  )
}
