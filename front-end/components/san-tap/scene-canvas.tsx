"use client"

import type * as THREE from "three"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"

import type { SanTapVisibility } from "./groups"
import type { SanTapArea, SanTapLabel } from "./labels"

export interface LabelScreen {
  id: string
  text: string
  areaId: string
  x: number
  y: number
  visible: boolean
}

export interface SanTapHandle {
  focus: (area: SanTapArea) => void
  zoom: (factor: number) => void
  reset: () => void
}

interface SanTapCanvasProps {
  onLabels?: (labels: LabelScreen[]) => void
  visibility?: SanTapVisibility
  className?: string
}

interface PendingFocus {
  target: THREE.Vector3
  zoom: number
  position?: THREE.Vector3
}

export const SanTapCanvas = forwardRef<SanTapHandle, SanTapCanvasProps>(function SanTapCanvas(
  { onLabels, visibility = {}, className },
  ref
) {
  const mountRef = useRef<HTMLDivElement>(null)
  const threeRef = useRef<typeof THREE | null>(null)
  const sceneRef = useRef<{
    camera: THREE.OrthographicCamera
    groups: Record<string, THREE.Group>
    labels: SanTapLabel[]
  } | null>(null)
  const controlsRef = useRef<{
    target: THREE.Vector3
    update: () => void
    minZoom: number
    maxZoom: number
  } | null>(null)
  const pendingRef = useRef<PendingFocus | null>(null)
  const baseZoomRef = useRef(1)
  const onLabelsRef = useRef(onLabels)
  onLabelsRef.current = onLabels

  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const visibilityRef = useRef(visibility)
  visibilityRef.current = visibility

  const applyVisibility = useCallback((next: SanTapVisibility) => {
    const groups = sceneRef.current?.groups
    if (!groups) return
    Object.entries(next).forEach(([key, visible]) => {
      const group = groups[key]
      if (group && visible !== undefined) group.visible = visible
    })
  }, [])

  useEffect(() => {
    applyVisibility(visibility)
  }, [applyVisibility, visibility])

  useImperativeHandle(
    ref,
    () => ({
      focus(area) {
        const THREE = threeRef.current
        if (!THREE) return
        pendingRef.current = {
          target: new THREE.Vector3(area.target[0], area.target[1], area.target[2]),
          zoom: Math.max(0.8, Math.min(3.5, 270 / area.distance)),
        }
      },
      zoom(factor) {
        const THREE = threeRef.current
        const controls = controlsRef.current
        const camera = sceneRef.current?.camera
        if (!THREE || !controls || !camera) return
        camera.zoom = THREE.MathUtils.clamp(
          camera.zoom / factor,
          controls.minZoom,
          controls.maxZoom
        )
        camera.updateProjectionMatrix()
        controls.update()
      },
      reset() {
        const THREE = threeRef.current
        if (!THREE) return
        pendingRef.current = {
          target: new THREE.Vector3(0, 0, 0),
          zoom: baseZoomRef.current,
          position: new THREE.Vector3(0, 320, 42),
        }
      },
    }),
    []
  )

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let frame = 0
    let cleanup: (() => void) | undefined

    const start = async () => {
      try {
        const THREE = await import("three")
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js")
        const { createSanTapScene } = await import("./scene")
        if (disposed) return
        threeRef.current = THREE

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const isMobile = window.matchMedia("(max-width: 768px)").matches

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
        renderer.shadowMap.enabled = !isMobile && !reduced
        renderer.shadowMap.type = THREE.PCFShadowMap
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.08
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.domElement.style.display = "block"
        renderer.domElement.style.width = "100%"
        renderer.domElement.style.height = "100%"
        renderer.domElement.style.touchAction = "none"
        mount.appendChild(renderer.domElement)

        const sanTap = createSanTapScene()
        sceneRef.current = { camera: sanTap.camera, groups: sanTap.groups, labels: sanTap.labels }
        applyVisibility(visibilityRef.current)

        const controls = new OrbitControls(sanTap.camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.07
        controls.enablePan = true
        controls.enableRotate = true
        controls.minPolarAngle = 0.08
        controls.maxPolarAngle = 1.3
        controls.minZoom = 0.72
        controls.maxZoom = 5
        controls.autoRotate = false
        controls.autoRotateSpeed = 0.22
        controls.target.copy(sanTap.target)
        controlsRef.current = controls

        let autoRotateTimer: number | undefined
        const pauseAutoRotate = () => {
          controls.autoRotate = false
          if (autoRotateTimer !== undefined) window.clearTimeout(autoRotateTimer)
          autoRotateTimer = undefined
        }
        const scheduleAutoRotate = () => {
          pauseAutoRotate()
          if (reduced) return
          autoRotateTimer = window.setTimeout(() => {
            controls.autoRotate = true
            autoRotateTimer = undefined
          }, 2000)
        }
        controls.addEventListener("start", pauseAutoRotate)
        controls.addEventListener("end", scheduleAutoRotate)
        scheduleAutoRotate()

        baseZoomRef.current = sanTap.camera.zoom

        const resize = () => {
          const width = mount.clientWidth || 1
          const height = mount.clientHeight || 1
          renderer.setSize(width, height, false)
          const aspect = width / height
          const portraitFit = aspect < 1 ? 1 / Math.max(aspect, 0.55) : 1
          const fittedHeight = sanTap.viewHeight * portraitFit
          sanTap.camera.left = (-fittedHeight * aspect) / 2
          sanTap.camera.right = (fittedHeight * aspect) / 2
          sanTap.camera.top = fittedHeight / 2
          sanTap.camera.bottom = -fittedHeight / 2
          sanTap.camera.updateProjectionMatrix()
          controls.update()
        }
        resize()

        const labelVector = new THREE.Vector3()
        let lastLabelTime = 0
        let running = true
        let onScreen = true

        const render = () => {
          frame = requestAnimationFrame(render)
          if (!running || !onScreen) return

          const now = performance.now()

          // Di chuyển camera mượt tới khu vực được chọn
          const pending = pendingRef.current
          if (pending) {
            pauseAutoRotate()
            controls.target.lerp(pending.target, 0.12)
            if (pending.position) sanTap.camera.position.lerp(pending.position, 0.12)
            sanTap.camera.zoom = THREE.MathUtils.lerp(sanTap.camera.zoom, pending.zoom, 0.12)
            sanTap.camera.updateProjectionMatrix()
            if (
              controls.target.distanceTo(pending.target) < 0.3 &&
              Math.abs(sanTap.camera.zoom - pending.zoom) < 0.02 &&
              (!pending.position || sanTap.camera.position.distanceTo(pending.position) < 0.5)
            ) {
              controls.target.copy(pending.target)
              sanTap.camera.zoom = pending.zoom
              if (pending.position) sanTap.camera.position.copy(pending.position)
              sanTap.camera.updateProjectionMatrix()
              pendingRef.current = null
              scheduleAutoRotate()
            }
            controls.update()
          }

          controls.update()
          renderer.render(sanTap.scene, sanTap.camera)

          if (onLabelsRef.current && now - lastLabelTime > 60) {
            lastLabelTime = now
            const width = mount.clientWidth || 1
            const height = mount.clientHeight || 1
            const projected: LabelScreen[] = sanTap.labels.map((label) => {
              labelVector.set(label.position[0], label.position[1], label.position[2])
              labelVector.project(sanTap.camera)
              const x = (labelVector.x * 0.5 + 0.5) * width
              const y = (-labelVector.y * 0.5 + 0.5) * height
              return {
                id: label.id,
                text: label.text,
                areaId: label.areaId,
                x,
                y,
                visible:
                  labelVector.z < 1 && x > 70 && x < width - 70 && y > 34 && y < height - 80,
              }
            })
            onLabelsRef.current(projected)
          }
        }
        render()

        const onVisibility = () => {
          running = !document.hidden
          if (running) scheduleAutoRotate()
          else pauseAutoRotate()
        }
        document.addEventListener("visibilitychange", onVisibility)

        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(mount)

        const intersectionObserver = new IntersectionObserver(
          (entries) => entries.forEach((entry) => (onScreen = entry.isIntersecting)),
          { threshold: 0 }
        )
        intersectionObserver.observe(mount)

        setReady(true)

        cleanup = () => {
          cancelAnimationFrame(frame)
          document.removeEventListener("visibilitychange", onVisibility)
          controls.removeEventListener("start", pauseAutoRotate)
          controls.removeEventListener("end", scheduleAutoRotate)
          pauseAutoRotate()
          resizeObserver.disconnect()
          intersectionObserver.disconnect()
          controls.dispose()
          sanTap.dispose()
          renderer.dispose()
          renderer.forceContextLoss()
          sceneRef.current = null
          controlsRef.current = null
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
        }
      } catch (error) {
        console.error("Không dựng được sân tập 3D", error)
        if (!disposed) setFailed(true)
      }
    }

    void start()

    return () => {
      disposed = true
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={className ?? "absolute inset-0"}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#c5dcf2,#eef4fa)]">
        <div ref={mountRef} className="absolute inset-0" />
      </div>
      {!ready && !failed ? (
        <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-navy/60">
          Đang dựng sân tập…
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-semibold text-navy/60">
          Thiết bị không hỗ trợ WebGL nên chưa xem được sân tập 3D.
        </div>
      ) : null}
    </div>
  )
})
