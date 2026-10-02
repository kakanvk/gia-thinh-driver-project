"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  amount?: number | "some" | "all"
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  amount = 0.18,
}: ScrollRevealProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.58, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
