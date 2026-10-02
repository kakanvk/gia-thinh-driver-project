import * as THREE from "three"

import {
  ACROSS_ROAD_TREE_SPOTS,
  PERIMETER_TREE_SPOTS,
  sitePointFromGrid,
  TRAFFIC_ISLAND_TREE_SPOTS,
} from "./data/site-layout"
import { cylGeo, mesh } from "./geo"
import { PALETTE, solid } from "./materials"

const trunkGeo = cylGeo(0.2, 0.3, 1.5, 6)
const blobGeo = new THREE.IcosahedronGeometry(1.35, 0)
const blobSmallGeo = new THREE.IcosahedronGeometry(0.9, 0)
const postGeo = cylGeo(0.2, 0.2, 1.32, 8)
const postBandGeo = cylGeo(0.23, 0.23, 0.26, 8)


const trunkMat = solid(PALETTE.trunk)
const leafMat = solid(PALETTE.leaf)
const leafDarkMat = solid(PALETTE.leafDark)
const leafLightMat = solid(PALETTE.leafLight)
const postMat = solid(PALETTE.carRed)
const postBandMat = solid(PALETTE.curbWhite)


function seededRandom(initialSeed: number) {
  let seed = initialSeed
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
}

function tree(random: () => number, scale = 1) {
  const group = new THREE.Group()
  const size = scale * (0.85 + random() * 0.4)
  const trunk = mesh(trunkGeo, trunkMat, 0, 0.75, 0)
  trunk.castShadow = true
  group.add(trunk)

  const tone = random()
  const foliage = tone > 0.66 ? leafDarkMat : tone > 0.33 ? leafMat : leafLightMat
  const top = mesh(blobGeo, foliage, 0, 2.4, 0)
  const bump = mesh(blobSmallGeo, foliage, 0.45, 3.3, 0.25)
  top.castShadow = true
  bump.castShadow = true
  group.add(top, bump)
  group.scale.setScalar(size)
  group.rotation.y = random() * Math.PI
  return group
}


function addTreeBand(
  group: THREE.Group,
  random: () => number,
  bounds: readonly [minGridX: number, maxGridX: number, minGridY: number, maxGridY: number],
  count: number,
  scale = 1
) {
  const [minGridX, maxGridX, minGridY, maxGridY] = bounds
  for (let index = 0; index < count; index += 1) {
    const gridX = minGridX + random() * (maxGridX - minGridX)
    const gridY = minGridY + random() * (maxGridY - minGridY)
    const [x, z] = sitePointFromGrid(gridX, gridY)
    const item = tree(random, scale + random() * 0.45)
    item.position.set(x, 0, z)
    group.add(item)
  }
}

function bollard() {
  const group = new THREE.Group()
  const post = mesh(postGeo, postMat, 0, 0.66, 0)
  post.castShadow = true
  group.add(post)
  group.add(mesh(postBandGeo, postBandMat, 0, 0.9, 0))
  group.add(mesh(postBandGeo, postBandMat, 0, 0.48, 0))
  return group
}


export function buildVegetation() {
  const group = new THREE.Group()
  group.name = "vegetation"
  const random = seededRandom(20260923)

  // Chỉ đặt cây trong các bồn cây được thể hiện trên mặt bằng.
  TRAFFIC_ISLAND_TREE_SPOTS.forEach(([x, z]) => {
    const item = tree(random, 0.75 + random() * 0.45)
    item.position.set(x, 0, z)
    group.add(item)
  })

  PERIMETER_TREE_SPOTS.forEach(([x, z]) => {
    const item = tree(random, 0.72 + random() * 0.32)
    item.position.set(x, 0, z)
    group.add(item)
  })

  ACROSS_ROAD_TREE_SPOTS.forEach(([x, z]) => {
    const item = tree(random, 1.2 + random() * 0.38)
    item.position.set(x, 0, z)
    group.add(item)
  })

  // Ba dải cây ngoài khuôn viên theo phối cảnh: sau nhà dân, sau nhà xưởng và bên kia sông.
  addTreeBand(group, random, [-57, -35, 12, 176], 60, 1.8)
  addTreeBand(group, random, [263, 278, 82, 166], 12, 1.3)
  addTreeBand(group, random, [285, 307, 10, 176], 44, 1.7)
  addTreeBand(group, random, [-4, 210, 216, 232], 52, 1.9)

  return group
}

export function buildTrainingProps() {
  const group = new THREE.Group()
  group.name = "trainingMarkings"
  const bollardsOnGrid: Array<[number, number]> = []
  for (let gridX = 110; gridX <= 190; gridX += 16) {
    bollardsOnGrid.push([gridX, 164], [gridX, 110])
  }
  for (let gridY = 122; gridY <= 152; gridY += 15) {
    bollardsOnGrid.push([110, gridY], [190, gridY])
  }
  bollardsOnGrid.forEach(([gridX, gridY]) => {
    const [x, z] = sitePointFromGrid(gridX, gridY)
    const item = bollard()
    item.position.set(x, 0, z)
    group.add(item)
  })
  return group
}

export function buildVehicles() {
  const group = new THREE.Group()
  group.name = "vehicles"
  // Bản vẽ tham chiếu thể hiện mặt sân trống; giữ layer để có thể bổ sung xe sau này.
  return group
}
