import * as THREE from "three"

import { box } from "../geo"
import type { SitePoint } from "../data/site-layout"

export function createPolygonMesh(
  points: readonly SitePoint[],
  material: THREE.Material,
  y: number
) {
  const shape = new THREE.Shape()
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z)
    else shape.lineTo(x, -z)
  })
  shape.closePath()

  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  mesh.receiveShadow = true
  return mesh
}

export function createSegmentedCurb(
  points: readonly SitePoint[],
  darkMaterial: THREE.Material,
  lightMaterial: THREE.Material,
  options: { y?: number; segmentLength?: number; width?: number; height?: number } = {}
) {
  const {
    y = 0.03,
    segmentLength = 1.55,
    width = 0.58,
    height = 0.24,
  } = options
  const group = new THREE.Group()

  points.forEach(([ax, az], edgeIndex) => {
    const [bx, bz] = points[(edgeIndex + 1) % points.length]
    const edgeLength = Math.hypot(bx - ax, bz - az)
    const segments = Math.max(1, Math.round(edgeLength / segmentLength))
    const angle = Math.atan2(bz - az, bx - ax)

    for (let index = 0; index < segments; index += 1) {
      const t = (index + 0.5) / segments
      const curb = box(
        edgeLength / segments + 0.03,
        height,
        width,
        (edgeIndex + index) % 2 === 0 ? darkMaterial : lightMaterial,
        ax + (bx - ax) * t,
        y + height / 2,
        az + (bz - az) * t,
        -angle
      )
      curb.castShadow = true
      curb.receiveShadow = true
      group.add(curb)
    }
  })

  return group
}


