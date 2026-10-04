import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { StatusPill } from "@/components/admin/admin-ui"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { DataTable } from "@/components/admin/data-table"
import { EntitySheet } from "@/components/admin/entity-sheet"
import { FilterBar } from "@/components/admin/filter-bar"
import { FormField } from "@/components/admin/form-field"
import { Pagination } from "@/components/admin/pagination"
import {
  APPOINTMENT_STATUS_LABELS,
  LEAD_STATUS_LABELS,
} from "@/lib/admin/labels"

type Row = { id: string; name: string }

const columns = [{ key: "name", header: "Tên", cell: (row: Row) => row.name }]

function renderTable(
  props: Partial<React.ComponentProps<typeof DataTable<Row>>>
) {
  return render(
    <DataTable<Row>
      columns={columns}
      rows={undefined}
      rowKey={(row) => row.id}
      isLoading={false}
      error={null}
      onRetry={vi.fn()}
      empty="Chưa có khách nào"
      {...props}
    />
  )
}

describe("DataTable", () => {
  it("hiện skeleton khi đang tải", () => {
    renderTable({ isLoading: true })
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true")
    expect(screen.getAllByTestId("data-table-skeleton").length).toBeGreaterThan(
      0
    )
    expect(screen.queryByText("Chưa có khách nào")).not.toBeInTheDocument()
  })

  it("hiện câu trống khi không có dòng", () => {
    renderTable({ rows: [] })
    expect(screen.getByText("Chưa có khách nào")).toBeInTheDocument()
  })

  it("hiện lỗi và nút Thử lại gọi onRetry", async () => {
    const onRetry = vi.fn()
    renderTable({ error: new Error("x"), onRetry })
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("hàng bấm được: tabIndex 0, Enter và click gọi onRowClick", async () => {
    const onRowClick = vi.fn()
    renderTable({
      rows: [
        { id: "1", name: "An" },
        { id: "2", name: "Bình" },
      ],
      onRowClick,
    })
    const row = screen.getByText("An").closest("tr")!
    expect(row).toHaveAttribute("tabindex", "0")
    row.focus()
    await userEvent.keyboard("{Enter}")
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "An" })
    await userEvent.click(screen.getByText("Bình"))
    expect(onRowClick).toHaveBeenLastCalledWith({ id: "2", name: "Bình" })
  })

  it("hàng không bấm được khi không có onRowClick", () => {
    renderTable({ rows: [{ id: "1", name: "An" }] })
    expect(screen.getByText("An").closest("tr")).not.toHaveAttribute("tabindex")
  })
})

describe("Pagination", () => {
  it("hiện số trang và chuyển trang", async () => {
    const onPageChange = vi.fn()
    render(
      <Pagination page={2} limit={20} total={45} onPageChange={onPageChange} />
    )
    expect(screen.getByText("Trang 2/3 · 45 bản ghi")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Sau/ }))
    expect(onPageChange).toHaveBeenLastCalledWith(3)
    await userEvent.click(screen.getByRole("button", { name: /Trước/ }))
    expect(onPageChange).toHaveBeenLastCalledWith(1)
  })

  it("khoá nút ở trang đầu và trang cuối", () => {
    const { rerender } = render(
      <Pagination page={1} limit={20} total={45} onPageChange={vi.fn()} />
    )
    expect(screen.getByRole("button", { name: /Trước/ })).toBeDisabled()
    rerender(
      <Pagination page={3} limit={20} total={45} onPageChange={vi.fn()} />
    )
    expect(screen.getByRole("button", { name: /Sau/ })).toBeDisabled()
  })

  it("ẩn khi chỉ có một trang", () => {
    const { container } = render(
      <Pagination page={1} limit={20} total={10} onPageChange={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe("FilterBar", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("debounce 300 ms trước khi gọi onChange", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(
      <FilterBar
        search={{ value: "", placeholder: "Tìm tên, SĐT", onChange }}
      />
    )
    const input = screen.getByPlaceholderText("Tìm tên, SĐT")
    fireEvent.change(input, { target: { value: "a" } })
    fireEvent.change(input, { target: { value: "an" } })
    expect(input).toHaveValue("an")
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("an")
  })

  it("đồng bộ khi value bên ngoài đổi", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FilterBar search={{ value: "an", placeholder: "Tìm", onChange }} />
    )
    expect(screen.getByPlaceholderText("Tìm")).toHaveValue("an")
    rerender(<FilterBar search={{ value: "", placeholder: "Tìm", onChange }} />)
    expect(screen.getByPlaceholderText("Tìm")).toHaveValue("")
  })

  it("đồng bộ lại khi quay về giá trị ô vừa gửi", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const props = { placeholder: "Tìm", onChange }
    const { rerender } = render(<FilterBar search={{ value: "", ...props }} />)
    const input = screen.getByPlaceholderText("Tìm")
    fireEvent.change(input, { target: { value: "an" } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenCalledWith("an")
    rerender(<FilterBar search={{ value: "an", ...props }} />)
    rerender(<FilterBar search={{ value: "", ...props }} />)
    expect(input).toHaveValue("")
    rerender(<FilterBar search={{ value: "an", ...props }} />)
    expect(input).toHaveValue("an")
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("không gửi lại lần gõ đang chờ khi bộ lọc bị xoá từ ngoài", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const props = { placeholder: "Tìm", onChange }
    const { rerender } = render(
      <FilterBar search={{ value: "an", ...props }} />
    )
    const input = screen.getByPlaceholderText("Tìm")
    fireEvent.change(input, { target: { value: "anh" } })
    rerender(<FilterBar search={{ value: "", ...props }} />)
    expect(input).toHaveValue("")
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("giữ chữ đang gõ khi URL bắt kịp giá trị đã gửi", () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const props = { placeholder: "Tìm", onChange }
    const { rerender } = render(<FilterBar search={{ value: "", ...props }} />)
    const input = screen.getByPlaceholderText("Tìm")
    fireEvent.change(input, { target: { value: "an" } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.change(input, { target: { value: "anh" } })
    rerender(<FilterBar search={{ value: "an", ...props }} />)
    expect(input).toHaveValue("anh")
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenLastCalledWith("anh")
  })

  it("hiện bộ lọc con", () => {
    render(
      <FilterBar>
        <span>Bộ lọc trạng thái</span>
      </FilterBar>
    )
    expect(screen.getByText("Bộ lọc trạng thái")).toBeInTheDocument()
  })
})

describe("EntitySheet", () => {
  it("submit form gọi onSubmit, Huỷ đóng sheet", async () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) =>
      event.preventDefault()
    )
    const onOpenChange = vi.fn()
    render(
      <EntitySheet
        open
        onOpenChange={onOpenChange}
        title="Thêm khách"
        onSubmit={onSubmit}
      >
        <input aria-label="Tên" />
      </EntitySheet>
    )
    expect(screen.getByText("Thêm khách")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("button", { name: "Huỷ" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("khoá nút khi đang gửi", () => {
    render(
      <EntitySheet
        open
        onOpenChange={vi.fn()}
        title="Sửa khách"
        submitLabel="Cập nhật"
        submitting
        onSubmit={vi.fn()}
      >
        <input aria-label="Tên" />
      </EntitySheet>
    )
    expect(screen.getByRole("button", { name: "Cập nhật" })).toBeDisabled()
  })

  it("không đóng được khi đang gửi (Escape, nút X)", async () => {
    const onOpenChange = vi.fn()
    render(
      <EntitySheet
        open
        onOpenChange={onOpenChange}
        title="Sửa khách"
        submitting
        onSubmit={vi.fn()}
      >
        <input aria-label="Tên" />
      </EntitySheet>
    )
    expect(
      screen.queryByRole("button", { name: "Close" })
    ).not.toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("không có onSubmit thì không có nút Lưu", () => {
    render(
      <EntitySheet open onOpenChange={vi.fn()} title="Chi tiết">
        <p>Nội dung</p>
      </EntitySheet>
    )
    expect(screen.getByText("Nội dung")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Lưu" })
    ).not.toBeInTheDocument()
  })
})

describe("ConfirmDialog", () => {
  it("bấm xác nhận gọi onConfirm", async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Xoá khách?"
        description="Không thể hoàn tác."
        confirmLabel="Xoá"
        destructive
        onConfirm={onConfirm}
      />
    )
    expect(screen.getByText("Không thể hoàn tác.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Xoá" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("Escape không đóng khi đang xử lý", async () => {
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Xoá?"
        pending
        onConfirm={vi.fn()}
      />
    )
    await userEvent.keyboard("{Escape}")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("khoá nút xác nhận khi đang xử lý", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Xoá?"
        pending
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled()
  })
})

describe("FormField", () => {
  it("gắn nhãn, lỗi và aria cho ô nhập", () => {
    render(
      <FormField id="name" label="Tên" required error="Bắt buộc">
        <input />
      </FormField>
    )
    const input = screen.getByLabelText(/Tên/)
    expect(input).toHaveAttribute("id", "name")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAttribute("aria-describedby", "name-error")
    expect(screen.getByText("Bắt buộc")).toHaveAttribute("id", "name-error")
  })

  it("children dạng hàm nhận props aria để tự gắn", () => {
    render(
      <FormField id="branch" label="Chi nhánh" required error="Chọn chi nhánh">
        {(control) => (
          <div>
            <button type="button" {...control}>
              Chọn
            </button>
          </div>
        )}
      </FormField>
    )
    const trigger = screen.getByRole("button", { name: /Chi nhánh/ })
    expect(trigger).toHaveAttribute("id", "branch")
    expect(trigger).toHaveAttribute("aria-invalid", "true")
    expect(trigger).toHaveAttribute("aria-describedby", "branch-error")
    expect(trigger).toHaveAttribute("aria-required", "true")
  })

  it("không có lỗi thì không gắn aria-invalid", () => {
    render(
      <FormField id="phone" label="SĐT">
        <input />
      </FormField>
    )
    expect(screen.getByLabelText("SĐT")).not.toHaveAttribute("aria-invalid")
  })
})

describe("StatusPill", () => {
  it("có màu riêng cho mọi trạng thái khách và lịch hẹn", () => {
    const labels = [
      ...Object.values(LEAD_STATUS_LABELS),
      ...Object.values(APPOINTMENT_STATUS_LABELS),
    ].filter((label) => label !== "Đã hủy")
    for (const label of labels) {
      const { unmount } = render(<StatusPill status={label} />)
      expect(screen.getByText(label)).not.toHaveClass("bg-muted")
      unmount()
    }
    render(<StatusPill status="Không thành công" />)
    expect(screen.getByText("Không thành công")).toHaveClass("text-destructive")
  })
})
