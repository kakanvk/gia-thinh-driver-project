import * as THREE from "three"

/** Tạo texture chữ bằng canvas — procedural, không cần file asset. */
export function makeTextTexture(
  lines: string[],
  options: {
    width?: number
    height?: number
    background?: string
    color?: string
    font?: string
    letterSpacing?: number
    uppercase?: boolean
  } = {}
) {
  const width = options.width ?? 512
  const height = options.height ?? 128
  const background = options.background ?? "#232830"
  const color = options.color ?? "#ffffff"
  const font = options.font ?? "bold 54px system-ui, sans-serif"
  const letterSpacing = options.letterSpacing ?? 0

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return new THREE.CanvasTexture(canvas)
  }

  if (background !== "transparent") {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  if (letterSpacing > 0 && "letterSpacing" in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${letterSpacing}px`
  }

  const lineHeight = height / (lines.length + 0.4)
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => {
    const text = options.uppercase === false ? line : line.toUpperCase()
    ctx.fillText(text, width / 2, startY + index * lineHeight)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
