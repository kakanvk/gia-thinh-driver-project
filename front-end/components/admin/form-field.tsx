import { cloneElement } from "react"

import { Label } from "@/components/ui/label"

type FieldControlProps = {
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  "aria-required"?: boolean
}

export function FormField({
  id,
  label,
  error,
  required = false,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  children: React.ReactElement<FieldControlProps>
}) {
  const errorId = `${id}-error`
  const control = cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    "aria-required": required || undefined,
  })

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px]">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </Label>
      {control}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
