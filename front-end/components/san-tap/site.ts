import * as THREE from "three"

import {
  CONCRETE_AREAS,
  LANDSCAPE_AREAS,
  ROAD_AREAS,
  SITE_BOUNDARY,
  TRAFFIC_ISLANDS,
  WATER_OUTLINE,
  sitePointFromGrid,
  type SitePoint,
} from "./data/site-layout"
import { box, groundPlane, mark } from "./geo"
import { createPolygonMesh, createSegmentedCurb } from "./geometry/polygon"
import type { SanTapGroupKey, SanTapGroups } from "./groups"
import { PALETTE, flat, solid } from "./materials"
import { ring } from "./road"
import { makeTextTexture } from "./text"

export const LOT = { minX: -92, maxX: 90, minZ: -90, maxZ: 90 } as const
export const WATER = { z: -111.5, halfWidth: 7.5 } as const

const LINE = flat(PALETTE.line)
const YELLOW = flat(PALETTE.yellow)
const CURB_BLACK = solid(PALETTE.curbBlack)
const CURB_WHITE = solid(PALETTE.curbWhite)
const PERIMETER_RED = solid(PALETTE.carRed)
const ASPHALT = solid(PALETTE.asphalt)
const CONCRETE_LIGHT = solid(PALETTE.concreteLight)
const GRASS = solid(PALETTE.grass)
const YARD_BASE = ASPHALT

function createGroups() {
  const keys: SanTapGroupKey[] = [
    "site",
    "roads",
    "trainingMarkings",
    "trafficIslands",
    "buildings",
    "parking",
    "vehicles",
    "vegetation",
    "surroundings",
    "water",
  ]
  return Object.fromEntries(
    keys.map((key) => {
      const group = new THREE.Group()
      group.name = key
      return [key, group]
    })
  ) as SanTapGroups
}

function lineX(z: number, x1: number, x2: number, y = 0.025, width = 0.24) {
  return mark(Math.abs(x2 - x1), width, LINE, (x1 + x2) / 2, y, z)
}

function lineZ(x: number, z1: number, z2: number, y = 0.025, width = 0.24) {
  return mark(width, Math.abs(z2 - z1), LINE, x, y, (z1 + z2) / 2)
}

function outlinedBay(x: number, z: number, w: number, d: number, rotation = 0) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation
  group.add(lineX(-d / 2, -w / 2, w / 2))
  group.add(lineX(d / 2, -w / 2, w / 2))
  group.add(lineZ(-w / 2, -d / 2, d / 2))
  group.add(lineZ(w / 2, -d / 2, d / 2))
  return group
}

function parkingSlots(
  x: number,
  z: number,
  count: number,
  cellWidth: number,
  depth: number,
  rotation = 0
) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation
  const x0 = -(count * cellWidth) / 2
  group.add(lineX(-depth / 2, x0, -x0))
  group.add(lineX(depth / 2, x0, -x0))
  for (let index = 0; index <= count; index += 1) {
    group.add(lineZ(x0 + index * cellWidth, -depth / 2, depth / 2))
  }
  return group
}

function figureEight(x: number, z: number, radius: number, spacing: number, vertical = true) {
  const group = new THREE.Group()
  const dx = vertical ? 0 : spacing / 2
  const dz = vertical ? spacing / 2 : 0
  group.add(ring(x - dx, z - dz, radius, 0.28, 0.026))
  group.add(ring(x + dx, z + dz, radius, 0.28, 0.026))
  return group
}

function zebraCrossing(
  x: number,
  z: number,
  width: number,
  rotation = 0,
  extraEndStripes = 0
) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation
  const maxOffset = width / 2 + extraEndStripes * 1.35
  for (let offset = -width / 2; offset <= maxOffset; offset += 1.35) {
    group.add(mark(0.62, 5.2, LINE, offset, 0.027, 0))
  }
  return group
}

function gridPosition(gridX: number, gridY: number) {
  const [x, z] = sitePointFromGrid(gridX, gridY)
  return { x, z }
}

function yellowGridLineX(gridY: number, gridX1: number, gridX2: number) {
  const [x1, z] = sitePointFromGrid(gridX1, gridY)
  const [x2] = sitePointFromGrid(gridX2, gridY)
  return mark(Math.abs(x2 - x1), 0.28, YELLOW, (x1 + x2) / 2, 0.032, z)
}

function yellowGridLineY(gridX: number, gridY1: number, gridY2: number) {
  const [x, z1] = sitePointFromGrid(gridX, gridY1)
  const [, z2] = sitePointFromGrid(gridX, gridY2)
  return mark(0.28, Math.abs(z2 - z1), YELLOW, x, 0.032, (z1 + z2) / 2)
}

function perimeter(points: readonly SitePoint[]) {
  return createSegmentedCurb(points, PERIMETER_RED, CURB_WHITE, {
    y: 0.03,
    segmentLength: 1.8,
    width: 0.5,
    height: 0.3,
  })
}

function gate() {
  const group = new THREE.Group()
  const z = 90
  const pillar = solid(PALETTE.wall)
  group.add(box(2, 3.4, 2, pillar, -10, 1.7, z))
  group.add(box(2, 3.4, 2, pillar, 10, 1.7, z))

  const texture = makeTextTexture(["GIA THỊNH"], {
    width: 1024,
    height: 180,
    background: "#d9dde1",
    color: "#1f252b",
    font: "bold 72px system-ui, sans-serif",
  })
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(18, 2.1, 0.5),
    new THREE.MeshBasicMaterial({ map: texture })
  )
  panel.position.set(0, 1.15, z)
  group.add(panel)
  return group
}

function addOpenPadMarkings(group: THREE.Group) {
  // Khu sát hạch ô tô: các tâm và kích thước lấy trực tiếp từ lưới bản vẽ.
  let position = gridPosition(153, 149)
  group.add(outlinedBay(position.x, position.z, 42, 7))
  position = gridPosition(151, 138)
  group.add(parkingSlots(position.x, position.z, 10, 3.8, 4))
  position = gridPosition(147, 122)
  group.add(outlinedBay(position.x, position.z, 58, 7))
  position = gridPosition(147, 114)
  group.add(parkingSlots(position.x, position.z, 9, 4.2, 4))

  // Các vòng xe máy theo đúng các tâm trên mặt bằng.
  position = gridPosition(120, 150)
  group.add(figureEight(position.x, position.z, 4.5, 10))
  position = gridPosition(95, 128)
  group.add(figureEight(position.x, position.z, 4.7, 10))
  position = gridPosition(43, 90)
  group.add(figureEight(position.x, position.z, 5.2, 11))
  position = gridPosition(61, 90)
  group.add(figureEight(position.x, position.z, 5.2, 11))

  // Bốn vòng luyện tập nằm phía trong cổng, trên hàng Y=15.
  position = gridPosition(99, 15)
  group.add(figureEight(position.x, position.z, 5.5, 18, false))
  position = gridPosition(136, 15)
  group.add(figureEight(position.x, position.z, 5.5, 18, false))
}

function addParkingMarkings(group: THREE.Group) {
  // Bốn vạch qua đường bao quanh nút giao X=110, Y=90.
  let position = gridPosition(110, 98)
  group.add(zebraCrossing(position.x, position.z, 11))
  position = gridPosition(110, 80)
  group.add(zebraCrossing(position.x, position.z, 10, 0, 1))
  position = gridPosition(101, 90)
  group.add(zebraCrossing(position.x, position.z, 9, Math.PI / 2))
  position = gridPosition(120, 90)
  group.add(zebraCrossing(position.x, position.z, 9, Math.PI / 2))

  const start = gridPosition(110, 80)
  const end = gridPosition(110, 10)
  group.add(lineZ(start.x, start.z, end.z, 0.026, 0.2))

  // Khung góc màu vàng của bài ghép xe cạnh đảo cây bên trái.
  group.add(
    yellowGridLineX(100, 143, 149),
    yellowGridLineY(143, 96, 100),
    yellowGridLineY(149, 96, 100)
  )
}

export function buildSiteGroups() {
  const groups = createGroups()

  // Bối cảnh ngoài hàng rào và nền đất trong ranh khuôn viên.
  const surroundings = groundPlane(10000, 10000, GRASS, 0, -0.03, -4)
  surroundings.receiveShadow = true
  groups.surroundings.add(surroundings)
  groups.site.add(createPolygonMesh(SITE_BOUNDARY.points, YARD_BASE, 0))

  CONCRETE_AREAS.forEach((area) => {
    const isLightTrainingPad =
      area.id === "automobile-training-pad" || area.id === "motorcycle-training-pad"
    const material = isLightTrainingPad ? CONCRETE_LIGHT : ASPHALT
    const surfaceY = area.id === "motorcycle-training-pad" ? 0.016 : 0.01
    groups.site.add(createPolygonMesh(area.points, material, surfaceY))
  })

  ROAD_AREAS.forEach((area) => {
    const target = area.id === "parking-training-lot" ? groups.parking : groups.roads
    target.add(createPolygonMesh(area.points, ASPHALT, 0.014))
  })

  LANDSCAPE_AREAS.forEach((area) => {
    groups.trafficIslands.add(createPolygonMesh(area.points, GRASS, 0.024))
  })

  TRAFFIC_ISLANDS.forEach((island) => {
    groups.trafficIslands.add(createPolygonMesh(island.points, GRASS, 0.025))
    groups.trafficIslands.add(createSegmentedCurb(island.points, CURB_BLACK, CURB_WHITE))
  })


  groups.site.add(perimeter(SITE_BOUNDARY.points))
  groups.site.add(gate())

  addOpenPadMarkings(groups.trainingMarkings)
  addParkingMarkings(groups.parking)


  // Đường giao thông phía trước cổng và đoạn nối vào sân.
  groups.trainingMarkings.add(mark(290, 0.34, YELLOW, 0, 0.026, 101))
  groups.trainingMarkings.add(lineX(93.7, -145, -11, 0.026, 0.2))
  groups.trainingMarkings.add(lineX(93.7, 11, 145, 0.026, 0.2))
  groups.trainingMarkings.add(lineX(108.3, -145, 145, 0.026, 0.2))
  groups.trainingMarkings.add(lineZ(-5, 88, 93, 0.026, 0.2))
  groups.trainingMarkings.add(lineZ(5, 88, 93, 0.026, 0.2))

  groups.water.add(createPolygonMesh(WATER_OUTLINE.points, solid(PALETTE.water), -0.01))
  groups.water.add(box(300, 0.8, 1.4, solid(PALETTE.wallShade), 0, 0.38, -104))


  return groups
}
