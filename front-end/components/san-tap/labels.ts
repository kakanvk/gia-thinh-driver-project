import { sitePointFromGrid } from "./data/site-layout"

export interface SanTapArea {
  id: string
  label: string
  target: [number, number, number]
  distance: number
}

export interface SanTapLabel {
  id: string
  text: string
  position: [number, number, number]
  areaId: string
}

function scenePosition(gridX: number, gridY: number, height = 0): [number, number, number] {
  const [x, z] = sitePointFromGrid(gridX, gridY)
  return [x, height, z]
}

export const sanTapAreas: SanTapArea[] = [
  { id: "toan-canh", label: "Toàn cảnh", target: scenePosition(110, 90), distance: 300 },
  { id: "duong-quanh-co", label: "Đường quanh co chữ S", target: scenePosition(73, 50), distance: 110 },
  { id: "khu-sat-hach", label: "Khu sát hạch ô tô", target: scenePosition(150, 136), distance: 125 },
  { id: "bai-do-xe", label: "Bãi tập đỗ xe", target: scenePosition(150, 50), distance: 115 },
  { id: "san-xe-may", label: "Sân xe máy & nhà xe", target: scenePosition(57, 145), distance: 105 },
  { id: "vong-so-8", label: "Vòng số 8", target: scenePosition(52, 90), distance: 76 },
  { id: "cong-chinh", label: "Cổng chính", target: scenePosition(110, 3), distance: 82 },
]

export const sanTapLabels: SanTapLabel[] = [
  { id: "l-course", text: "Đường quanh co chữ S", position: scenePosition(71, 49, 6), areaId: "duong-quanh-co" },
  { id: "l-exam", text: "Khu sát hạch ô tô", position: scenePosition(150, 136, 6), areaId: "khu-sat-hach" },
  { id: "l-parking", text: "Bãi tập đỗ xe", position: scenePosition(150, 50, 6), areaId: "bai-do-xe" },
  { id: "l-moto", text: "Sân xe máy", position: scenePosition(57, 145, 8), areaId: "san-xe-may" },
  { id: "l-eight", text: "Vòng số 8", position: scenePosition(52, 90, 5), areaId: "vong-so-8" },
  { id: "l-gate", text: "Cổng chính", position: scenePosition(110, 3, 7), areaId: "cong-chinh" },
]
