"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  Building2,
  Compass,
  Layers,
  MapPin,
  Minus,
  Navigation,
  Plus,
  RotateCcw,
  Tag,
  TreePine,
} from "lucide-react"

import type { SanTapGroupKey, SanTapVisibility } from "./groups"
import { sanTapAreas, type SanTapArea } from "./labels"
import { SanTapCanvas, type LabelScreen, type SanTapHandle } from "./scene-canvas"
import { cn } from "@/lib/utils"

const MAPS_URL = "https://maps.app.goo.gl/YnhavYPxurxH3qbw6"

const initialVisibility: SanTapVisibility = {
  buildings: true,
  vegetation: true,
}

const stats = [
  { label: "Kích thước mặt bằng", value: "182 × 180 m" },
  { label: "Bài sát hạch", value: "Vòng số 8 · Quanh co · Ghép chuồng" },
  { label: "Khu chức năng", value: "4 khu" },
  { label: "Nhà xe", value: "5 cụm mái tôn" },
  { label: "Hạng đào tạo", value: "A · A1 · B · C1" },
]

export function SanTapExperience() {
  const canvasRef = useRef<SanTapHandle>(null)
  const [activeArea, setActiveArea] = useState("toan-canh")
  const [labels, setLabels] = useState<LabelScreen[]>([])
  const [showLabels, setShowLabels] = useState(true)
  const [visibility, setVisibility] = useState<SanTapVisibility>(initialVisibility)
  const showBuildings = visibility.buildings !== false
  const showTrees = visibility.vegetation !== false

  const toggleLayer = useCallback((key: SanTapGroupKey) => {
    setVisibility((current) => ({ ...current, [key]: current[key] === false }))
  }, [])

  const focusArea = useCallback((area: SanTapArea) => {
    setActiveArea(area.id)
    canvasRef.current?.focus(area)
  }, [])

  const onLabels = useCallback((next: LabelScreen[]) => {
    setLabels(next)
  }, [])

  const visibleLabels = useMemo(
    () =>
      showLabels
        ? labels.filter((label) => label.visible)
        : [],
    [labels, showLabels]
  )

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#dcebf8]">
      <SanTapCanvas
        ref={canvasRef}
        onLabels={onLabels}
        visibility={visibility}
      />

      {/* Nhãn gắn trên mô hình */}
      <div className="pointer-events-none absolute inset-0">
        {visibleLabels.map((label) => (
          <button
            key={label.id}
            type="button"
            onClick={() => {
              const area = sanTapAreas.find((item) => item.id === label.areaId)
              if (area) focusArea(area)
            }}
            style={{ left: label.x, top: label.y }}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-bold whitespace-nowrap text-navy shadow-md shadow-navy/10 backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"
          >
            {label.text}
          </button>
        ))}
      </div>

      {/* Bảng điều khiển bên trái */}
      <div className="pointer-events-none absolute top-0 left-0 hidden w-[324px] p-4 lg:block">
        <div className="pointer-events-auto max-h-full overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-navy/10 backdrop-blur-md">
          <p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">
            Mô phỏng 3D · Sân tập Gia Thịnh
          </p>
          <h1 className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight text-navy">
            Sân tập sát hạch Gia Thịnh
          </h1>
          <p className="san-tap-panel-description mt-2 text-xs leading-5 text-muted-foreground">
            Mô phỏng 3D sân tập theo mặt bằng thực tế: đường quanh co chữ S, vòng số 8, khu sát hạch, bãi
            đỗ xe và nhà xe mái tôn.
          </p>

          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="san-tap-panel-address mt-3 inline-flex items-start gap-2 text-[11px] leading-4 font-semibold text-navy/80 hover:text-primary"
          >
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-logo-red" />
            <span>
              QL 53 · Khóm 4, Trung Thành, Vũng Liêm, Vĩnh Long
              <span className="ml-1 text-primary underline">Chỉ đường</span>
            </span>
          </a>

          <nav aria-label="Khu vực sân tập" className="mt-3 flex flex-col gap-0.5">
            {sanTapAreas.map((area) => {
              const active = area.id === activeArea
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => focusArea(area)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors",
                    active
                      ? "bg-logo-red text-white shadow-sm"
                      : "text-navy/80 hover:bg-navy/5 hover:text-navy"
                  )}
                >
                  <Layers
                    aria-hidden="true"
                    className={cn("size-4 shrink-0", active ? "text-white" : "text-primary")}
                  />
                  {area.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="Phóng to"
              onClick={() => canvasRef.current?.zoom(0.82)}
              className="grid size-9 place-items-center rounded-lg border border-navy/10 bg-white text-navy transition-colors hover:bg-navy/5"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Thu nhỏ"
              onClick={() => canvasRef.current?.zoom(1.22)}
              className="grid size-9 place-items-center rounded-lg border border-navy/10 bg-white text-navy transition-colors hover:bg-navy/5"
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Về toàn cảnh"
              onClick={() => {
                setActiveArea("toan-canh")
                canvasRef.current?.reset()
              }}
              className="grid size-9 place-items-center rounded-lg border border-navy/10 bg-white text-navy transition-colors hover:bg-navy/5"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Thẻ tiêu đề gọn cho mobile */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4 lg:hidden">
        <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-center shadow-lg shadow-navy/10 backdrop-blur">
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
            Trung tâm đào tạo lái xe · 3D
          </p>
          <p className="mt-0.5 text-base font-extrabold text-navy">Sân tập Gia Thịnh</p>
        </div>
      </div>

      {/* Nút trên cùng bên phải */}
      <div className="pointer-events-none absolute top-4 right-4 hidden items-center gap-2 lg:flex">
        <button
          type="button"
          onClick={() => setShowLabels((value) => !value)}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold shadow-md backdrop-blur transition-colors",
            showLabels
              ? "border-primary/30 bg-white/90 text-primary"
              : "border-white/70 bg-white/70 text-navy/60"
          )}
        >
          <Tag aria-hidden="true" className="size-4" />
          {showLabels ? "Đang hiện nhãn" : "Đang ẩn nhãn"}
        </button>

        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-bold text-navy shadow-md backdrop-blur transition-colors hover:text-primary"
        >
          <Navigation aria-hidden="true" className="size-4 text-logo-red" />
          Google Maps
        </a>
      </div>

      {/* Thanh công cụ dưới giữa — trên mobile nâng lên để tránh nút gọi nổi */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4 lg:bottom-4">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 p-1.5 shadow-lg shadow-navy/10 backdrop-blur">
          <button
            type="button"
            onClick={() => toggleLayer("buildings")}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
              showBuildings ? "bg-navy text-white" : "text-navy/60 hover:bg-navy/5"
            )}
          >
            <Building2 aria-hidden="true" className="size-4" />
            Nhà cửa
          </button>
          <button
            type="button"
            onClick={() => toggleLayer("vegetation")}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
              showTrees ? "bg-navy text-white" : "text-navy/60 hover:bg-navy/5"
            )}
          >
            <TreePine aria-hidden="true" className="size-4" />
            Cây xanh
          </button>
          <span className="hidden h-6 w-px bg-navy/10 sm:block" />
          <span className="hidden px-2 text-[11px] font-semibold text-navy/45 sm:block">
            Bật/tắt lớp hiển thị
          </span>
        </div>
      </div>

      {/* Thông số mô hình */}
      <div className="pointer-events-none absolute right-4 bottom-24 hidden w-72 xl:block">
        <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/90 p-5 shadow-lg shadow-navy/10 backdrop-blur">
          <p className="text-[11px] font-bold tracking-[0.16em] text-navy/50 uppercase">
            Thông số sân tập
          </p>
          <dl className="mt-3 flex flex-col gap-2.5">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-start justify-between gap-3 text-xs">
                <dt className="text-muted-foreground">{stat.label}</dt>
                <dd className="max-w-[140px] text-right font-bold text-navy">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Gợi ý thao tác */}
      <div className="pointer-events-none absolute bottom-4 left-4 hidden items-center gap-3 rounded-full border border-white/60 bg-white/85 px-4 py-2 text-[11px] font-semibold text-navy/70 shadow-md backdrop-blur md:flex">
        <span className="flex items-center gap-1.5">
          <Compass aria-hidden="true" className="size-4 text-primary" />
          Kéo để xoay
        </span>
        <span className="h-3 w-px bg-navy/15" />
        <span>Cuộn để zoom</span>
        <span className="h-3 w-px bg-navy/15" />
        <span>Chọn khu vực để xem</span>
      </div>
    </div>
  )
}
