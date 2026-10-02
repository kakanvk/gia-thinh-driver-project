import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

/**
 * Gộp mọi mesh con (theo vật liệu) thành vài mesh lớn để giảm draw call.
 * Dùng cho scene tĩnh — không dùng khi cần animate từng vật.
 */
export function mergeStaticGroup(
  source: THREE.Group,
  options: { cast?: boolean; receive?: boolean } = {}
) {
  const { cast = true, receive = true } = options
  source.updateMatrixWorld(true)
  const inverse = new THREE.Matrix4().copy(source.matrixWorld).invert()
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const local = new THREE.Matrix4()

  source.traverse((object) => {
    const m = object as THREE.Mesh
    if (!m.isMesh) return
    const material = Array.isArray(m.material) ? m.material[0] : m.material
    const geometry = m.geometry.clone().toNonIndexed()
    geometry.clearGroups()
    local.multiplyMatrices(inverse, m.matrixWorld)
    geometry.applyMatrix4(local)

    const list = buckets.get(material)
    if (list) list.push(geometry)
    else buckets.set(material, [geometry])
  })

  const group = new THREE.Group()
  group.name = source.name

  buckets.forEach((geometries, material) => {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false)
    if (!merged) {
      geometries.forEach((geometry) => {
        const m = new THREE.Mesh(geometry, material)
        m.castShadow = cast
        m.receiveShadow = receive
        group.add(m)
      })
      return
    }
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = cast
    mesh.receiveShadow = receive
    group.add(mesh)
  })

  return group
}
