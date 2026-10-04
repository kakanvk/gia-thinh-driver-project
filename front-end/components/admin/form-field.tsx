import { cloneElement } from "react"

import { Label } from "@/components/ui/label"

export type FieldControlProps = {
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
  // Hàm: tự gắn props vào phần tử cần (VD SelectTrigger, vì Select.Root bỏ aria-*)
  children:
    | React.ReactElement<FieldControlProps>
    | ((props: FieldControlProps) => React.ReactElement)
}) {
  const errorId = `${id}-error`
  const controlProps: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    "aria-required": required || undefined,
  }
  const control =
    typeof children === "function"
      ? children(controlProps)
      : cloneElement(children, controlProps)

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
