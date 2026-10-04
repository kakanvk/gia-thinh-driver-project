import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { ConsultationForm } from "@/components/consultation-form"
import { setAccessToken } from "@/lib/api/session"
import { jsonResponse, mockFetch } from "@/test/fetch-mock"

const props = {
  branches: [
    { slug: "tan-ngai", label: "VP1 — Tân Ngãi" },
    { slug: "vung-liem", label: "VP Vũng Liêm" },
  ],
  courses: [
    { code: "A1", name: "Hạng A1" },
    { code: "B", name: "Hạng B" },
  ],
  contactTimes: [{ label: "Buổi sáng", value: "Buổi sáng (07:00–11:30)" }],
  contact: { hotline: "0779 666 664", telHref: "tel:0779666664", zaloHref: "https://zalo.me/0779666664" },
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText("Họ và tên"), "Nguyễn Văn An")
  await userEvent.type(screen.getByLabelText("Số điện thoại"), "0909123456")
  // Base UI Checkbox gắn nhãn cho cả span role=checkbox và input ẩn: chọn theo role
  await userEvent.click(screen.getByRole("checkbox", { name: /Tôi đồng ý/ }))
}

beforeEach(() => {
  setAccessToken(null)
  window.history.replaceState(null, "", "/tu-van?utm_source=facebook")
})

describe("ConsultationForm", () => {
  it("gửi lead với chi nhánh/gói điền sẵn, consent, honeypot rỗng và utm", async () => {
    const { calls } = mockFetch({ "POST /public/leads": () => jsonResponse(201, { data: { received: true } }) })
    render(<ConsultationForm {...props} initialBranch="vung-liem" initialCourse="B" />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    expect(await screen.findByText(/Đã nhận thông tin/)).toBeInTheDocument()
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      name: "Nguyễn Văn An",
      phone: "0909123456",
      branch: "vung-liem",
      courseCode: "B",
      preferredContactTime: "Buổi sáng (07:00–11:30)",
      consent: true,
      website: "",
      utm: { source: "facebook" },
    })
  })

  it("không có gói điền sẵn → mặc định 'Chưa xác định', không gửi courseCode", async () => {
    const { calls } = mockFetch({ "POST /public/leads": () => jsonResponse(201, { data: { received: true } }) })
    render(<ConsultationForm {...props} initialCourse="KHONG-CO" />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    await screen.findByText(/Đã nhận thông tin/)
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.courseCode).toBeUndefined()
    expect(body.branch).toBe("tan-ngai")
  })

  it("ô honeypot bị ẩn khỏi người dùng", () => {
    render(<ConsultationForm {...props} />)
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement
    expect(honeypot).not.toBeNull()
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("lỗi trường từ backend hiện dưới ô", async () => {
    mockFetch({
      "POST /public/leads": () =>
        jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ",
            details: [{ path: "body.phone", message: "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0" }],
          },
        }),
    })
    render(<ConsultationForm {...props} />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    expect(await screen.findByText("Số điện thoại phải có 10 chữ số, bắt đầu bằng 0")).toBeInTheDocument()
  })

  it("429 → báo gửi quá nhiều kèm hotline", async () => {
    mockFetch({
      "POST /public/leads": () =>
        jsonResponse(429, { error: { code: "RATE_LIMITED", message: "Bạn đã gửi quá nhiều yêu cầu" } }),
    })
    render(<ConsultationForm {...props} />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: /Gửi thông tin tư vấn/ }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("quá nhiều")
    expect(alert).toHaveTextContent("0779 666 664")
  })

  it("bấm gửi hai lần nhanh chỉ gửi một request", async () => {
    let resolve: (r: Response) => void = () => undefined
    const { calls } = mockFetch({
      "POST /public/leads": () => new Promise<Response>((r) => (resolve = r)),
    })
    render(<ConsultationForm {...props} />)
    await fillRequired()
    const button = screen.getByRole("button", { name: /Gửi thông tin tư vấn/ })
    await userEvent.click(button)
    await userEvent.click(button)
    resolve(jsonResponse(201, { data: { received: true } }))
    await screen.findByText(/Đã nhận thông tin/)
    expect(calls).toHaveLength(1)
  })

  it("không có chi nhánh → báo gọi hotline thay vì form", () => {
    render(<ConsultationForm {...props} branches={[]} />)
    expect(screen.getByText(/gọi hotline/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Gửi thông tin tư vấn/ })).not.toBeInTheDocument()
  })
})
