import * as THREE from "three"

import { buildBuildings } from "./buildings"
import type { SanTapGroups } from "./groups"
import { sanTapLabels, type SanTapLabel } from "./labels"
import { disposeMaterials, PALETTE } from "./materials"
import { mergeStaticGroup } from "./merge"
import { buildTrainingProps, buildVehicles, buildVegetation } from "./props"
import { buildSiteGroups } from "./site"

export interface SanTapScene {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  target: THREE.Vector3
  labels: SanTapLabel[]
  groups: SanTapGroups
  viewHeight: number
  dispose: () => void
}

function merged(source: THREE.Group, options: { cast?: boolean; receive?: boolean } = {}) {
  const result = mergeStaticGroup(source, options)
  result.name = source.name
  return result
}

export function createSanTapScene(): SanTapScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(PALETTE.grassBackground)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x91a67d, 1.35))
  scene.add(new THREE.AmbientLight(0xffffff, 0.18))

  const sun = new THREE.DirectionalLight(0xffffff, 1.45)
  sun.position.set(-85, 190, 95)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 20
  sun.shadow.camera.far = 520
  sun.shadow.camera.left = -145
  sun.shadow.camera.right = 145
  sun.shadow.camera.top = 145
  sun.shadow.camera.bottom = -145
  sun.shadow.bias = -0.00045
  sun.shadow.radius = 2
  scene.add(sun, sun.target)

  const raw = buildSiteGroups()
  raw.buildings.add(buildBuildings())
  raw.trainingMarkings.add(buildTrainingProps())
  raw.vehicles.add(buildVehicles())
  raw.vegetation.add(buildVegetation())

  const groups: SanTapGroups = {
    site: merged(raw.site, { cast: false, receive: true }),
    roads: merged(raw.roads, { cast: false, receive: true }),
    trainingMarkings: merged(raw.trainingMarkings, { cast: true, receive: false }),
    trafficIslands: merged(raw.trafficIslands, { cast: true, receive: true }),
    buildings: merged(raw.buildings, { cast: true, receive: true }),
    parking: merged(raw.parking, { cast: false, receive: true }),
    vehicles: merged(raw.vehicles, { cast: true, receive: true }),
    vegetation: merged(raw.vegetation, { cast: true, receive: true }),
    surroundings: merged(raw.surroundings, { cast: false, receive: true }),
    water: merged(raw.water, { cast: false, receive: true }),
  }

  Object.values(groups).forEach((group) => scene.add(group))

  const viewHeight = 232
  const camera = new THREE.OrthographicCamera(-116, 116, 116, -116, 1, 700)
  camera.position.set(0, 320, 42)
  camera.lookAt(0, 0, 0)
  camera.zoom = 1
  camera.updateProjectionMatrix()

  function dispose() {
    scene.traverse((object) => {
      const material = (object as THREE.Mesh).material
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
      else if (material) material.dispose()
      const geometry = (object as THREE.Mesh).geometry
      if (geometry) geometry.dispose()
    })
    disposeMaterials()
    scene.clear()
  }

  return {
    scene,
    camera,
    target: new THREE.Vector3(0, 0, 0),
    labels: sanTapLabels,
    groups,
    viewHeight,
    dispose,
  }
}
