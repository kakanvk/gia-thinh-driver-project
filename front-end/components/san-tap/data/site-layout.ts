export type SitePoint = readonly [x: number, z: number]

export interface SitePolygon {
  id: string
  points: readonly SitePoint[]
}

export interface SiteRect {
  x: number
  z: number
  width: number
  depth: number
}

/**
 * Hệ lưới của bản thiết kế dùng X từ trái sang phải, Y từ cổng lên phía trên.
 * Three.js đặt gốc gần giữa cổng, X giữ nguyên chiều và Z chạy từ trên xuống.
 */
export const SITE_GRID = {
  originX: 110,
  originY: 90,
  minX: 18,
  maxX: 200,
  minY: 0,
  maxY: 180,
} as const

export function sitePointFromGrid(gridX: number, gridY: number): SitePoint {
  return [gridX - SITE_GRID.originX, SITE_GRID.originY - gridY]
}

/** Chuyển footprint hình chữ nhật trên bản vẽ sang tâm và kích thước Three.js. */
export function siteRectFromGrid(x1: number, y1: number, x2: number, y2: number): SiteRect {
  const [x, z] = sitePointFromGrid((x1 + x2) / 2, (y1 + y2) / 2)
  return { x, z, width: Math.abs(x2 - x1), depth: Math.abs(y2 - y1) }
}

function polygon(id: string, gridPoints: readonly SitePoint[]): SitePolygon {
  return {
    id,
    points: gridPoints.map(([gridX, gridY]) => sitePointFromGrid(gridX, gridY)),
  }
}

export const SITE_BOUNDARY = polygon("site-boundary", [
  [18, 180], [200, 180], [200, 0], [18, 0],
])

export const CONCRETE_AREAS: readonly SitePolygon[] = [
  polygon("automobile-training-pad", [
    [112, 164], [186, 164],
    [188, 163.5], [189.5, 162], [190, 160],
    [190, 112], [189.5, 110], [188, 108.5], [186, 108],
    [112, 108], [110, 108.5], [108.5, 110], [108, 112],
    [108, 158], [108.5, 160.5], [110, 162.5],
  ]),
  polygon("motorcycle-training-pad", [
    [19, 128], [87, 128], [87, 138], [100, 138], [100, 106],
    [99.5, 103], [98, 100], [95, 97], [30, 60], [19, 64],
  ]),
  polygon("central-apron", [
    [103, 106], [187, 106], [190, 102], [190, 86], [185, 82],
    [122, 82], [117, 78], [104, 78], [97, 83], [93, 88],
  ]),
]

export const ROAD_AREAS: readonly SitePolygon[] = [
  polygon("front-access-road", [
    [-40, 0], [100, 0], [100, 5], [120, 5], [120, 0],
    [260, 0], [260, -16], [-40, -16],
  ]),
  polygon("north-west-service-road", [
    [18, 180], [200, 180], [200, 165], [80, 165], [80, 146],
    [87, 146], [87, 128], [79, 122], [18, 122],
  ]),
  polygon("west-loop-road", [
    [18, 149], [28, 151], [28, 163], [59, 163], [59, 138],
    [82, 138], [82, 126], [75, 121], [25, 121], [18, 128],
  ]),
  polygon("cross-connector", [
    [98, 107], [182, 107], [188, 102], [188, 88], [182, 82],
    [123, 82], [117, 77], [106, 77], [98, 84], [92, 88],
  ]),
  polygon("central-access", [
    [103, 101], [119, 101], [120, 0], [100, 0], [103, 24], [103, 76],
  ]),
  polygon("s-course-surface", [
    [35, 80], [52, 86], [72, 86], [92, 82], [104, 75],
    [107, 61], [106, 18], [98, 8], [55, 8], [41, 15],
    [35, 31], [34, 58],
  ]),
  polygon("parking-training-lot", [
    [118, 83], [182, 83], [191, 77], [191, 14], [184, 7],
    [120, 7], [114, 13], [114, 73],
  ]),
]

/** Các dải cỏ phẳng không có bó vỉa. */
export const LANDSCAPE_AREAS: readonly SitePolygon[] = [
  polygon("main-gate-trees-west", [
    [18, 0], [100, 0], [100, 5], [18, 5],
  ]),
  polygon("main-gate-trees-east", [
    [120, 0], [200, 0], [200, 5], [120, 5],
  ]),
]

export const TRAFFIC_ISLANDS: readonly SitePolygon[] = [
  // Dải cây phía sau các nhà phụ trợ; phần tam giác bên dưới là sân xe máy bê tông.
  polygon("north-west-garden", [
    [20, 130], [76, 130], [76, 109], [66, 106], [52, 102],
    [37, 98], [26, 96], [20, 99],
  ]),

  // Ba đảo cây độc lập tạo hai làn uốn liên tiếp của bài đường quanh co chữ S.
  polygon("s-island-north", [
    [68, 72], [83, 80.5], [88, 82.5], [94, 83], [99, 83],
    [102, 82.5], [103, 81.5],
    [104, 80], [104, 78], [104, 68], [104, 23],
    [98, 23], [98, 56], [98, 58], [97, 62], [95.5, 65], [93, 67.5],
    [90, 69], [87, 69], [84, 68], [81, 66], [78, 64], [76, 62],
    [73, 61], [70, 61], [68, 63],
    [66, 66], [66, 69],
  ]),
  polygon("s-island-middle", [
    [57, 64], [56, 60], [58, 56], [61, 53], [66, 51], [72, 50],
    [77, 51], [81, 52.5], [84, 55], [86, 57], [87, 56.5], [88, 54],
    [88, 44], [88, 39], [87.8, 37], [87, 35.5], [86.2, 35.7],
    [84.8, 36.3], [83.5, 38], [81.5, 40], [79, 40.8], [77, 40.8],
    [73, 40.8], [69, 41], [65, 42], [61, 43], [58, 45], [55, 49],
    [53, 53], [52, 56], [52, 59], [53, 62], [54, 63],
  ]),
  polygon("s-island-south", [
    [40.8, 56.5], [41.2, 58], [42, 58], [43, 56], [43, 51],
    [44, 47], [45, 44.5], [47, 42], [50, 39.5], [53, 37.5],
    [57, 35.5], [60, 34], [64, 33.5], [68, 33.5], [72, 32.8],
    [76.5, 31], [78.5, 28], [80, 25.5], [80, 22], [40, 22],
    [40, 41], [40, 48], [40, 52],
  ]),

  polygon("parking-island-entry", [
    [122, 102], [149, 102], [149, 97], [145, 96], [137, 96],
    [137, 92], [127, 92], [122, 96],
  ]),
  polygon("parking-island-entry-center", [
    [157, 102], [165, 102], [165, 96], [157, 96],
  ]),
  polygon("parking-island-long", [
    [122, 84], [181, 84], [181, 78], [142, 78], [142, 68],
    [122, 68], [118, 72], [118, 80],
  ]),
  polygon("parking-island-east", [
    [157, 69], [181, 69], [181, 55], [157, 55],
  ]),
  polygon("parking-island-west-center", [
    [120, 54], [134, 54], [134, 39], [143, 39], [143, 23],
    [135, 23], [135, 37], [120, 37],
  ]),
  polygon("parking-island-south-east", [
    [151, 40], [181, 40], [181, 22], [151, 22],
  ]),
]


/** Cây nội khu bám theo footprint trên hệ lưới. */
export const TRAFFIC_ISLAND_TREE_SPOTS: readonly SitePoint[] = [
  // Vườn góc trên-trái.
  [27, 122], [35, 120], [43, 118], [51, 115], [59, 112], [68, 110],
  [28, 108], [36, 104], [46, 102], [57, 104], [67, 106],

  // Cụm đường chữ S; từng điểm nằm trong một trong ba đảo, không nằm trên làn chạy.
  [88, 78], [94, 79], [99, 76],
  [75, 70], [82, 72], [90, 70], [98, 67], [100.5, 56], [100.5, 45], [100.5, 34],
  [55, 61], [63, 52], [70, 50], [77, 50], [82, 49],
  [44, 42], [50, 37], [56, 34], [63, 31], [68, 29],
  [46, 28], [54, 27], [62, 27], [68, 27],

  // Cụm bãi tập đỗ xe.
  [127, 98], [135, 98], [143, 99], [161, 99],
  [126, 79], [135, 79], [147, 80], [159, 80], [170, 80],
  [127, 72], [139, 72], [162, 63], [171, 59],
  [126, 48], [132, 43], [139, 35], [142, 27],
  [154, 35], [163, 35], [172, 35], [155, 27], [166, 26], [173, 27],
].map(([gridX, gridY]) => sitePointFromGrid(gridX, gridY))

/** Hai hàng cây so le trên dải đất phía đối diện đường trước cổng. */
export const ACROSS_ROAD_TREE_SPOTS: readonly SitePoint[] = [
  [25, -23], [39, -23], [53, -23], [67, -23], [81, -23], [95, -23],
  [123, -23], [137, -23], [151, -23], [165, -23], [179, -23], [193, -23],
  [32, -31], [47, -31], [62, -31], [77, -31], [92, -31],
  [126, -31], [141, -31], [156, -31], [171, -31], [186, -31],
].map(([gridX, gridY]) => sitePointFromGrid(gridX, gridY))

/** Hàng cây bao ranh theo phối cảnh thực tế, tách khỏi cây trong bồn giao thông. */
export const PERIMETER_TREE_SPOTS: readonly SitePoint[] = [
  // Mép cổng chính.
  [36, 2], [49, 2], [63, 2], [77, 2], [91, 2],
  [129, 2], [143, 2], [157, 2], [171, 2], [185, 2], [198, 3],
  // Mép phải.
  [199, 18], [199, 35], [199, 52], [199, 70], [199, 89],
  [199, 108], [199, 126], [199, 144], [199, 161],
  // Mép trên và góc trên-trái.
  [29, 179], [43, 179], [58, 179], [75, 179], [128, 178],
  [145, 178], [163, 178], [181, 178], [198, 176],
].map(([gridX, gridY]) => sitePointFromGrid(gridX, gridY))

export const WATER_OUTLINE = polygon("canal", [
  [-40, 209], [260, 209], [260, 194], [-40, 194],
])
