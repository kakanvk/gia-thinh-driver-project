import type * as THREE from "three"

export const SAN_TAP_GROUP_KEYS = [
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
] as const

export type SanTapGroupKey = (typeof SAN_TAP_GROUP_KEYS)[number]
export type SanTapGroups = Record<SanTapGroupKey, THREE.Group>
export type SanTapVisibility = Partial<Record<SanTapGroupKey, boolean>>
