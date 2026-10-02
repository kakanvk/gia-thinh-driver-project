import * as THREE from "three"

const boxCache = new Map<string, THREE.BoxGeometry>()
const cylCache = new Map<string, THREE.CylinderGeometry>()
const coneCache = new Map<string, THREE.ConeGeometry>()
const sphereCache = new Map<string, THREE.SphereGeometry>()
const planeCache = new Map<string, THREE.PlaneGeometry>()
const circleCache = new Map<string, THREE.CircleGeometry>()

export function boxGeo(w: number, h: number, d: number) {
  const key = `${w}|${h}|${d}`
  let geo = boxCache.get(key)
  if (!geo) {
    geo = new THREE.BoxGeometry(w, h, d)
    boxCache.set(key, geo)
  }
  return geo
}

export function cylGeo(radiusTop: number, radiusBottom: number, height: number, segments = 12) {
  const key = `${radiusTop}|${radiusBottom}|${height}|${segments}`
  let geo = cylCache.get(key)
  if (!geo) {
    geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
    cylCache.set(key, geo)
  }
  return geo
}

export function coneGeo(radius: number, height: number, segments = 8) {
  const key = `${radius}|${height}|${segments}`
  let geo = coneCache.get(key)
  if (!geo) {
    geo = new THREE.ConeGeometry(radius, height, segments)
    coneCache.set(key, geo)
  }
  return geo
}

export function sphereGeo(radius: number, segments = 8) {
  const key = `${radius}|${segments}`
  let geo = sphereCache.get(key)
  if (!geo) {
    geo = new THREE.SphereGeometry(radius, segments, Math.max(4, Math.round(segments / 2)))
    sphereCache.set(key, geo)
  }
  return geo
}

export function planeGeo(w: number, h: number) {
  const key = `${w}|${h}`
  let geo = planeCache.get(key)
  if (!geo) {
    geo = new THREE.PlaneGeometry(w, h)
    planeCache.set(key, geo)
  }
  return geo
}

export function circleGeo(radius: number, segments = 32) {
  const key = `${radius}|${segments}`
  let geo = circleCache.get(key)
  if (!geo) {
    geo = new THREE.CircleGeometry(radius, segments)
    circleCache.set(key, geo)
  }
  return geo
}

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rotationY = 0
) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  m.rotation.y = rotationY
  return m
}

export function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rotationY = 0
) {
  return mesh(boxGeo(w, h, d), material, x, y, z, rotationY)
}

export function groundDisc(
  radius: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  segments = 24
) {
  const m = mesh(circleGeo(radius, segments), material, x, y, z)
  m.rotation.x = -Math.PI / 2
  return m
}

export function groundPlane(
  w: number,
  h: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotationY = 0
) {
  const m = mesh(planeGeo(w, h), material, x, y, z)
  m.rotation.x = -Math.PI / 2
  m.rotation.z = rotationY
  return m
}

export function mark(
  w: number,
  h: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotationZ = 0
) {
  const m = groundPlane(w, h, material, x, y, z)
  m.rotation.z = rotationZ
  return m
}
