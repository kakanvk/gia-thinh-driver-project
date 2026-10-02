"use client"

import { ExternalLink, MapPin, X } from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/**
 * Dữ liệu văn phòng chỉ lưu link tìm kiếm dạng
 * `google.com/maps/search/?api=1&query=<địa chỉ>` nên lấy lại `query` để dựng
 * URL nhúng, tránh phải lưu thêm một trường bản đồ thứ hai.
 */
function toEmbedUrl(mapUrl: string) {
  try {
    const query = new URL(mapUrl).searchParams.get("query")
    if (!query) return null

    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&hl=vi&output=embed`
  } catch {
    return null
  }
}

export function BranchMapSheet({
  branchName,
  address,
  mapUrl,
}: {
  branchName: string
  address: string
  mapUrl: string
}) {
  const embedUrl = toEmbedUrl(mapUrl)

  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-background px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
          />
        }
      >
        <MapPin aria-hidden="true" className="size-3.5" />
        Bản đồ
        <span className="sr-only">chi nhánh {branchName}</span>
      </SheetTrigger>

      {/*
       * Mặc định của SheetContent là `data-[side=right]:sm:max-w-sm`, selector này
       * có thêm attribute nên ưu tiên cao hơn class thường. Dùng `!` để ghi đè
       * tường minh, không phụ thuộc vào thứ tự phát CSS.
       */}
      <SheetContent
        side="right"
        showCloseButton={false}
        className="sm:max-w-lg!"
      >
        <SheetHeader className="flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <SheetTitle>Bản đồ chi nhánh {branchName}</SheetTitle>
            <SheetDescription className="mt-0.5">{address}</SheetDescription>
          </div>
          <SheetClose
            render={
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">Đóng bản đồ</span>
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 px-4">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`Bản đồ chi nhánh ${branchName}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-full w-full rounded-md border border-border/70"
            />
          ) : (
            <p className="rounded-md bg-muted/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
              Chưa có toạ độ bản đồ cho chi nhánh này. Dùng nút bên dưới để tra
              theo địa chỉ.
            </p>
          )}
        </div>

        <SheetFooter>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/85"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            Mở trong Google Maps
            <span className="sr-only">(mở trong tab mới)</span>
          </a>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
