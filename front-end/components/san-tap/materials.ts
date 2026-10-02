import * as THREE from "three"

export const PALETTE = {
  // Mặt sàn
  concrete: 0xc9ccd1,
  concreteLight: 0xd8dbdf,
  asphalt: 0xa6abb2,
  asphaltDark: 0x989ea5,
  paver: 0xdcdee1,
  soil: 0x81775d,
  // Cỏ
  grass: 0x86b961,
  grassBackground: 0x9fc27b,
  grassDark: 0x74ac52,
  grassLight: 0xa8d184,
  // Vạch kẻ
  line: 0xf4f5f6,
  yellow: 0xe3bd3a,
  curbBlack: 0x2c3035,
  curbWhite: 0xf1f2f4,
  // Tường / rào
  wall: 0xe9eaed,
  wallShade: 0xd2d5d9,
  fence: 0xb7bcc3,
  // Nhà
  building: 0xf4f5f7,
  buildingShade: 0xe2e4e8,
  roofShed: 0xcdd5d9,
  roofShedAlt: 0xbcc7cc,
  roofGreen: 0xb9cbbf,
  roofBeige: 0xd9c8b1,
  roofGrey: 0xb8c1c6,
  roofRed: 0xc06a5a,
  glass: 0xa9c9df,
  // Cây
  trunk: 0x8a6a4a,
  leaf: 0x6fb04a,
  leafDark: 0x54923a,
  leafLight: 0x8cc95f,
  // Xe
  carWhite: 0xeff1f2,
  carSilver: 0xc4c8cd,
  carBlack: 0x32363c,
  carRed: 0xbf3a30,
  carBlue: 0x36506b,
  carTeal: 0x3f8f96,
  tyre: 0x2a2d31,
  // Khác
  sign: 0x232830,
  signPost: 0x6a7078,
  cone: 0xef7a2a,
  water: 0x6fb3d6,
} as const

const solidCache = new Map<number, THREE.MeshStandardMaterial>()
const flatCache = new Map<number, THREE.MeshBasicMaterial>()

/** Vật liệu đổ bóng, tô phẳng kiểu low-poly. Dùng chung theo màu. */
export function solid(color: number) {
  let material = solidCache.get(color)
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.88,
      metalness: 0,
    })
    solidCache.set(color, material)
  }
  return material
}

/** Vật liệu không nhận sáng, dùng cho vạch kẻ / bảng hiệu / chữ. */
export function flat(color: number) {
  let material = flatCache.get(color)
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color })
    flatCache.set(color, material)
  }
  return material
}

export function disposeMaterials() {
  solidCache.forEach((material) => material.dispose())
  flatCache.forEach((material) => material.dispose())
  solidCache.clear()
  flatCache.clear()
}
