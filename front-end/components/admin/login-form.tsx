"use client"

import { Eye, EyeOff, LoaderCircle } from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { useAuth } from "@/components/admin/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, errorMessage, fieldErrors } from "@/lib/api/errors"
import { firstAllowedPath, safeNext } from "@/lib/auth/routes"

export function LoginForm() {
  const { status, permissions, login } = useAuth()
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === "authenticated") router.replace(next ?? firstAllowedPath(permissions))
  }, [status, next, permissions, router])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = identifier.trim()
    const nextErrors: Record<string, string> = {}
    if (!id) nextErrors.identifier = "Vui lòng nhập số điện thoại hoặc tên đăng nhập"
    if (!password) nextErrors.password = "Vui lòng nhập mật khẩu"
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await login(id, password)
    } catch (error) {
      const fields = error instanceof ApiError ? fieldErrors(error.details) : {}
      if (Object.keys(fields).length > 0) setErrors(fields)
      else setFormError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      data-admin-shell
      className="grid min-h-svh place-items-center bg-muted/60 p-4 text-[13px]"
    >
      <div className="w-full max-w-sm rounded-lg border border-border/70 bg-background p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src="/giathinh-logo.png"
            alt=""
            width={56}
            height={56}
            className="size-14 object-contain"
          />
          <h1 className="text-lg font-bold tracking-tight text-navy">Đăng nhập quản trị</h1>
          <p className="text-muted-foreground">Trường lái Gia Thịnh</p>
        </div>

        <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier">Số điện thoại hoặc tên đăng nhập</Label>
            <Input
              id="identifier"
              name="identifier"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              aria-invalid={errors.identifier ? true : undefined}
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
            />
            {errors.identifier ? (
              <p id="identifier-error" className="text-destructive">
                {errors.identifier}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="text-destructive">
                {errors.password}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={submitting || status === "loading"}>
            {submitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Đăng nhập
          </Button>

          <p className="text-center text-muted-foreground">
            Quên mật khẩu? Liên hệ quản trị viên để được cấp mật khẩu tạm.
          </p>
        </form>
      </div>
    </main>
  )
}
