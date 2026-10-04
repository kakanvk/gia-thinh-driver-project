"use client"

import { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  // Giá trị ô này vừa gửi mà URL chưa phản ánh lại; null khi không có gì chờ
  const [emitted, setEmitted] = useState<string | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Giá trị ngoài đổi (vd. xoá bộ lọc, quay lại trang) → đồng bộ ô nhập;
  // bỏ qua đúng một lần khi đó chỉ là giá trị chính ô này vừa gửi (URL cập
  // nhật trễ), rồi coi như đã khớp để lần quay lại giá trị đó vẫn đồng bộ.
  if (value !== synced) {
    setSynced(value)
    setEmitted(null)
    if (value !== emitted) setText(value)
  }

  // Debounce theo nội dung ô: mỗi lần ô đổi (kể cả do đồng bộ từ ngoài) thì
  // huỷ lần gửi đang chờ, nên xoá bộ lọc không bị lần gõ cũ ghi đè lại.
  useEffect(() => {
    const next = text.trim()
    if (next === value) return
    const timer = setTimeout(() => {
      setEmitted(next)
      onChangeRef.current(next)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, value])

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
        onChange={(event) => setText(event.target.value)}
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

// Giá trị "Tất cả" cho Select lọc (Base UI không có item rỗng)
const ALL = "all"

export type FilterItem = { value: string; label: string }

export function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: FilterItem[]
  value: string
  onChange: (value: string) => void
}) {
  const all = [{ value: ALL, label: `${label}: Tất cả` }, ...items]
  return (
    <Select
      items={all}
      value={value || ALL}
      onValueChange={(next) => onChange(!next || next === ALL ? "" : next)}
    >
      <SelectTrigger
        aria-label={label}
        className="h-9 bg-background text-[13px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {all.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
