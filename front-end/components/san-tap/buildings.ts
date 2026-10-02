import * as THREE from "three"

import { siteRectFromGrid, type SiteRect } from "./data/site-layout"
import { box } from "./geo"
import { PALETTE, solid } from "./materials"

interface BuildingOptions {
  x: number
  z: number
  w: number
  d: number
  height?: number
  wallColor?: number
  roofColor?: number
  rotY?: number
  pitched?: boolean
  roofHeight?: number
}

function building({
  x,
  z,
  w,
  d,
  height = 3.5,
  wallColor = PALETTE.building,
  roofColor = PALETTE.roofGrey,
  rotY = 0,
  pitched = false,
  roofHeight = 2,
}: BuildingOptions) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotY

  const body = box(w, height, d, solid(wallColor), 0, height / 2, 0)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  if (pitched) {
    const shape = new THREE.Shape()
    const roofWidth = w + 0.8
    shape.moveTo(-roofWidth / 2, 0)
    shape.lineTo(roofWidth / 2, 0)
    shape.lineTo(0, roofHeight)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d + 0.8,
      bevelEnabled: false,
    })
    geometry.translate(0, 0, -(d + 0.8) / 2)
    const roof = new THREE.Mesh(geometry, solid(roofColor))
    roof.position.y = height
    roof.castShadow = true
    roof.receiveShadow = true
    group.add(roof)
  } else {
    const roof = box(w + 0.5, 0.42, d + 0.5, solid(roofColor), 0, height + 0.1, 0)
    roof.castShadow = true
    group.add(roof)
  }

  return group
}

/** Mái tôn có sống mái chạy theo chiều ngang như trên bản vẽ. */
function openShed(
  x: number,
  z: number,
  w: number,
  d: number,
  roofColor: number = PALETTE.roofShed,
  height = 3.1
) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  const postMaterial = solid(PALETTE.fence)
  const columns = Math.max(2, Math.round(w / 7))

  for (let index = 0; index <= columns; index += 1) {
    const px = -w / 2 + (index * w) / columns
    group.add(box(0.28, height, 0.28, postMaterial, px, height / 2, -d / 2 + 0.35))
    group.add(box(0.28, height, 0.28, postMaterial, px, height / 2, d / 2 - 0.35))
  }

  const angle = 0.16
  const halfDepth = d / 2 + 0.35
  const roofMaterial = solid(roofColor)
  const near = box(w + 0.8, 0.3, halfDepth, roofMaterial, 0, height + 0.42, d / 4)
  near.rotation.x = angle
  const far = box(w + 0.8, 0.3, halfDepth, roofMaterial, 0, height + 0.42, -d / 4)
  far.rotation.x = -angle
  near.castShadow = true
  far.castShadow = true
  group.add(near, far)
  return group
}

function solarCanopy(x: number, z: number, w: number, d: number) {
  const group = openShed(x, z, w, d, PALETTE.roofGreen, 3.3)
  const panelMaterial = solid(PALETTE.carTeal)
  const columns = Math.max(2, Math.floor(w / 3.2))
  const rows = Math.max(2, Math.floor(d / 3.2))
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      group.add(
        box(
          2.6,
          0.12,
          2.5,
          panelMaterial,
          -w / 2 + 1.8 + (column * (w - 3.6)) / Math.max(1, columns - 1),
          4,
          -d / 2 + 1.7 + (row * (d - 3.4)) / Math.max(1, rows - 1)
        )
      )
    }
  }
  return group
}

function buildingOnGrid(
  rect: SiteRect,
  options: Omit<BuildingOptions, "x" | "z" | "w" | "d"> = {}
) {
  return building({
    x: rect.x,
    z: rect.z,
    w: rect.width,
    d: rect.depth,
    ...options,
  })
}

function shedOnGrid(rect: SiteRect, roofColor: number = PALETTE.roofShed, height = 3.1) {
  return openShed(rect.x, rect.z, rect.width, rect.depth, roofColor, height)
}

function addSurroundingBuildings(group: THREE.Group) {
  // Cụm nhà dân phía Tây, nằm hoàn toàn ngoài ranh X=18.
  const westBuildings: Array<{
    rect: [number, number, number, number]
    roofColor: number
    height?: number
    rotY?: number
  }> = [
    { rect: [-4, 138, 17, 169], roofColor: PALETTE.roofGrey, height: 5.5, rotY: 0.12 },
    { rect: [-26, 126, 5, 144], roofColor: PALETTE.roofBeige, height: 4.6 },
    { rect: [-28, 104, 6, 124], roofColor: PALETTE.roofGrey, height: 4.2 },
    { rect: [-23, 82, 8, 101], roofColor: PALETTE.roofRed, height: 4.8 },
    { rect: [-27, 60, 9, 79], roofColor: PALETTE.roofBeige, height: 4.3 },
    { rect: [-29, 37, 11, 57], roofColor: PALETTE.roofGreen, height: 4.8 },
    { rect: [-31, 9, 15, 31], roofColor: PALETTE.roofGreen, height: 5.2, rotY: -0.08 },
  ]
  westBuildings.forEach(({ rect, roofColor, height = 4.2, rotY = 0 }) => {
    group.add(
      buildingOnGrid(siteRectFromGrid(...rect), {
        height,
        roofColor,
        pitched: true,
        roofHeight: 1.7,
        rotY,
      })
    )
  })

  // Các mái nhà dọc bờ sông phía Bắc.
  ;[
    [35, 181, 67, 194, PALETTE.roofGrey],
    [69, 181, 101, 193, PALETTE.roofRed],
    [112, 181, 143, 194, PALETTE.roofShed],
    [145, 181, 184, 192, PALETTE.roofGrey],
  ].forEach(([x1, y1, x2, y2, roofColor]) => {
    group.add(shedOnGrid(siteRectFromGrid(x1, y1, x2, y2), roofColor, 3.8))
  })

  // Nhà xưởng lớn và các khối kho phụ nằm sát phía Đông khuôn viên.
  group.add(shedOnGrid(siteRectFromGrid(201, 49, 214, 179), PALETTE.roofGrey, 5.2))
  group.add(
    buildingOnGrid(siteRectFromGrid(215, 48, 255, 179), {
      height: 8,
      wallColor: PALETTE.buildingShade,
      roofColor: PALETTE.roofBeige,
      pitched: true,
      roofHeight: 4.5,
    })
  )

  group.add(shedOnGrid(siteRectFromGrid(255, 49, 280, 72), PALETTE.roofBeige, 5))
  group.add(
    buildingOnGrid(siteRectFromGrid(201, 0, 229, 48), {
      height: 6.5,
      roofColor: PALETTE.roofRed,
    })
  )
  group.add(
    buildingOnGrid(siteRectFromGrid(229, 0, 280, 46), {
      height: 7.2,
      roofColor: PALETTE.roofGrey,
    })
  )
}

export function buildBuildings() {
  const group = new THREE.Group()
  group.name = "buildings"

  // Tất cả footprint dưới đây dùng trực tiếp hệ tọa độ 0–200 × 0–180 của bản vẽ.
  // Dãy công trình sát mép trên.
  group.add(shedOnGrid(siteRectFromGrid(29, 157, 38, 169), PALETTE.roofGrey))
  group.add(shedOnGrid(siteRectFromGrid(38, 155, 58, 171), PALETTE.roofShed))
  group.add(shedOnGrid(siteRectFromGrid(58, 155, 72, 171), PALETTE.roofGreen))
  group.add(shedOnGrid(siteRectFromGrid(29, 139, 77, 151), PALETTE.roofGreen))
  group.add(shedOnGrid(siteRectFromGrid(130, 166, 141, 175), PALETTE.roofGrey))
  group.add(shedOnGrid(siteRectFromGrid(144, 166, 170, 174), PALETTE.roofShed))

  // Nhà điều hành và các nhà phụ trợ ở nửa trái sân.
  const solarRect = siteRectFromGrid(87, 138, 99, 154)
  group.add(solarCanopy(solarRect.x, solarRect.z, solarRect.width, solarRect.depth))
  group.add(
    buildingOnGrid(siteRectFromGrid(25, 113, 39, 128), {
      height: 4.2,
      roofColor: PALETTE.roofGrey,
    })
  )
  group.add(shedOnGrid(siteRectFromGrid(34, 113, 42, 126), PALETTE.roofShed))
  group.add(shedOnGrid(siteRectFromGrid(72, 111, 84, 128), PALETTE.roofGreen))

  // Dãy nhà xe chạy dọc mép trái, chia đúng theo các khoang trên mặt bằng.
  ;[
    [20, 2, 31, 22],
    [20, 22, 31, 34],
    [20, 34, 31, 55],
    [20, 55, 31, 78],
  ].forEach(([x1, y1, x2, y2], index) => {
    group.add(
      shedOnGrid(
        siteRectFromGrid(x1, y1, x2, y2),
        index % 2 === 0 ? PALETTE.roofGrey : PALETTE.roofShedAlt
      )
    )
  })

  addSurroundingBuildings(group)

  return group
}
