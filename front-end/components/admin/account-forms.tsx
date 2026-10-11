"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/components/admin/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiData } from "@/lib/api/client"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"
import type { SessionUser } from "@/lib/auth/user"

function TextField({
  id,
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function handleError(error: unknown, setErrors: (errors: Record<string, string>) => void) {
  const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
  setErrors(fields)
  if (Object.keys(fields).length === 0) toast.error(errorMessage(error))
}

export function ProfileForm() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (body: { name: string; phone: string }) =>
      apiData<{ user: SessionUser; permissions: string[] }>("/auth/me", {
        method: "PATCH",
        body,
      }),
    meta: { silent: true },
    onSuccess: (data) => {
      setUser(data.user)
      setErrors({})
      toast.success("Đã lưu hồ sơ")
    },
    onError: (error) => handleError(error, setErrors),
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({ name: name.trim(), phone: phone.trim() })
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField id="username" label="Tên đăng nhập" value={user?.username ?? ""} readOnly />
      <TextField
        id="name"
        label="Họ và tên"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
      <TextField
        id="phone"
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={errors.phone}
      />
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        Lưu hồ sơ
      </Button>
    </form>
  )
}

export function PasswordForm() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    meta: { silent: true },
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setErrors({})
      toast.success("Đã đổi mật khẩu")
    },
    onError: (error) => handleError(error, setErrors),
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!currentPassword) nextErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại"
    if (newPassword.length < 8) nextErrors.newPassword = "Mật khẩu tối thiểu 8 ký tự"
    if (newPassword !== confirmPassword) nextErrors.confirmPassword = "Mật khẩu nhập lại không khớp"
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    mutation.mutate()
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        id="currentPassword"
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        error={errors.currentPassword}
      />
      <TextField
        id="newPassword"
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={errors.newPassword}
      />
      <TextField
        id="confirmPassword"
        label="Nhập lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={errors.confirmPassword}
      />
      <p className="text-muted-foreground">
        Tối thiểu 8 ký tự, có chữ cái và chữ số. Các thiết bị khác sẽ phải đăng nhập lại.
      </p>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        Đổi mật khẩu
      </Button>
    </form>
  )
}
