import * as THREE from "three"

import { PALETTE, solid } from "./materials"

let stripeTexture: THREE.Texture | null = null

/** Texture sọc đen-trắng lặp dọc theo chiều dài đường (dùng cho lề đá). */
export function stripeMap() {
  if (stripeTexture) return stripeTexture
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 4
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#2c3035"
    ctx.fillRect(0, 0, 64, 4)
    ctx.fillStyle = "#f1f2f4"
    ctx.fillRect(64, 0, 128, 4)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.repeat.set(1 / 3.2, 1)
  stripeTexture = texture
  return texture
}

let stripeMat: THREE.MeshBasicMaterial | null = null
export function stripeMaterial() {
  if (!stripeMat) {
    stripeMat = new THREE.MeshBasicMaterial({ map: stripeMap(), side: THREE.DoubleSide })
  }
  return stripeMat
}

/** Lấy mẫu đường cong mượt từ các điểm điều khiển. */
export function samplePath(controls: Array<[number, number]>, samples = 240) {
  const curve = new THREE.CatmullRomCurve3(
    controls.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "catmullrom",
    0.5
  )
  return curve.getSpacedPoints(samples)
}

/**
 * Dải ribbon mượt dọc path: hai mép lệch theo pháp tuyến offsetA/offsetB.
 * UV.x = quãng đường (mét) để map sọc lề đá theo chiều dài.
 */
export function ribbon(points: THREE.Vector3[], offsetA: number, offsetB: number, y: number) {
  const n = points.length
  const position = new Float32Array(n * 2 * 3)
  const normal = new Float32Array(n * 2 * 3)
  const uv = new Float32Array(n * 2 * 2)
  const index: number[] = []
  let distance = 0

  for (let i = 0; i < n; i += 1) {
    const p = points[i]
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(n - 1, i + 1)]
    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.hypot(tx, tz) || 1
    const nx = -tz / len
    const nz = tx / len
    if (i > 0) distance += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z)

    const li = i * 6
    position[li] = p.x + nx * offsetA
    position[li + 1] = y
    position[li + 2] = p.z + nz * offsetA
    position[li + 3] = p.x + nx * offsetB
    position[li + 4] = y
    position[li + 5] = p.z + nz * offsetB
    normal[li + 1] = 1
    normal[li + 4] = 1
    uv[i * 4] = distance
    uv[i * 4 + 2] = distance
    uv[i * 4 + 1] = 0
    uv[i * 4 + 3] = 1
  }

  for (let i = 0; i < n - 1; i += 1) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3))
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3))
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  geometry.setIndex(index)
  return geometry
}

/** Đường cong mượt + hai dải lề đá kẻ sọc. */
export function curvedRoad(
  controls: Array<[number, number]>,
  width: number,
  y: number,
  options: { curb?: number; samples?: number } = {}
) {
  const { curb = 0.75, samples = 240 } = options
  const group = new THREE.Group()
  const points = samplePath(controls, samples)
  const half = width / 2

  group.add(new THREE.Mesh(ribbon(points, -half, half, y), solid(PALETTE.asphalt)))
  group.add(new THREE.Mesh(ribbon(points, half, half + curb, y - 0.015), stripeMaterial()))
  group.add(new THREE.Mesh(ribbon(points, -half - curb, -half, y - 0.015), stripeMaterial()))
  return group
}

/** Vòng tròn kẻ sân (vành trắng). */
export function ring(x: number, z: number, radius: number, stroke: number, y: number) {
  const geometry = new THREE.RingGeometry(radius - stroke / 2, radius + stroke / 2, 64)
  const mesh = new THREE.Mesh(geometry, solid(PALETTE.line))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, y, z)
  return mesh
}
