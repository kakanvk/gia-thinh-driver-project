"use client"

import { useRef } from "react"
import Image from "next/image"
import { CircleCheckBig } from "lucide-react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

export function HeroVisual() {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  })
  const carY = useTransform(scrollYProgress, [0, 1], [0, 54])
  const plateY = useTransform(scrollYProgress, [0, 1], [0, -22])

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-2xl">
      <div aria-hidden="true" className="hero-track absolute inset-x-[8%] top-[3%] aspect-square rounded-full opacity-60" />

      <motion.div
        className="relative overflow-hidden rounded-[2rem] border border-white/70 shadow-2xl shadow-primary/15"
        style={{ y: shouldReduceMotion ? 0 : carY }}
      >
        <Image
          src="/main-banner.png"
          alt="Học viên thực hành lái xe cùng giáo viên Gia Thịnh trên xe tập lái"
          width={1536}
          height={1024}
          priority
          className="h-auto w-full object-cover"
        />
      </motion.div>

      <motion.div
        className="absolute left-0 top-[13%] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl shadow-primary/10 sm:left-[2%]"
        style={{ y: shouldReduceMotion ? 0 : plateY }}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-success/10 text-success">
            <CircleCheckBig aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Xe tập đời mới</p>
            <p className="text-sm font-bold text-navy">Học 1 kèm 1 theo ca</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-[5%] right-[2%] border-l-4 border-signal bg-navy px-5 py-4 text-white shadow-xl sm:right-[5%]"
        style={{ y: shouldReduceMotion ? 0 : plateY }}
      >
        <p className="text-xs text-white/55">Lớp gần nhất</p>
        <p className="mt-1 font-bold">14/09 · Hạng A1</p>
      </motion.div>
    </div>
  )
}
