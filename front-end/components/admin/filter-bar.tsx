"use client"

import { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

const DEBOUNCE_MS = 300

function SearchBox({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const [text, setText] = useState(value)
  const [synced, setSynced] = useState(value)
  const [emitted, setEmitted] = useState(value)
  const onChangeRef = useRef(onChange)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  // Giá trị ngoài đổi (vd. xoá bộ lọc, quay lại trang) → đồng bộ ô nhập;
  // bỏ qua khi đó chỉ là giá trị chính ô này vừa gửi (URL cập nhật trễ)
  if (value !== synced) {
    setSynced(value)
    if (value !== emitted) setText(value)
  }

  function handleChange(next: string) {
    setText(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      setEmitted(next.trim())
      onChangeRef.current(next.trim())
    }, DEBOUNCE_MS)
  }

  return (
    <label className="relative min-w-0 sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={text}
        placeholder={placeholder}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 bg-background pl-9 text-[13px]"
      />
    </label>
  )
}

export function FilterBar({
  search,
  children,
}: {
  search?: { value: string; placeholder: string; onChange: (v: string) => void }
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/70 p-4 sm:flex-row sm:flex-wrap sm:items-center">
      {search ? (
        <SearchBox
          value={search.value}
          placeholder={search.placeholder}
          onChange={search.onChange}
        />
      ) : null}
      {children}
    </div>
  )
}
