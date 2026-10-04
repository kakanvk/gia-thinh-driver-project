import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"

describe("ThemeHotkey", () => {
  it("bỏ qua keydown không có key (Chrome autofill)", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }))
    )
    render(<ThemeProvider>nội dung</ThemeProvider>)
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => {
      errors.push(event.error)
      event.preventDefault()
    }
    window.addEventListener("error", onError)
    window.dispatchEvent(new Event("keydown"))
    window.removeEventListener("error", onError)
    expect(errors).toEqual([])
  })
})
