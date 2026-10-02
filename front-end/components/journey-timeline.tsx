"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll } from "motion/react"

type JourneyStep = {
  title: string
  text: string
}

type JourneyTimelineProps = {
  steps: JourneyStep[]
}

export function JourneyTimeline({ steps }: JourneyTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 85%", "end 45%"],
  })

  return (
    <div ref={containerRef} className="relative mt-12 lg:grid lg:grid-cols-4 lg:gap-8">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 hidden h-0.5 bg-primary/15 lg:block">
        <motion.div
          className="h-full origin-left bg-primary"
          style={{ scaleX: shouldReduceMotion ? 1 : scrollYProgress }}
        />
      </div>
      {steps.map((step, index) => (
        <article
          key={step.title}
          className="relative pl-12 pb-10 before:absolute before:top-4 before:bottom-0 before:left-4 before:w-px before:bg-gradient-to-b before:from-primary/40 before:via-primary/20 before:to-primary/5 last:pb-0 last:before:hidden lg:border-t-2 lg:border-primary/15 lg:pt-6 lg:pb-0 lg:pl-0 lg:before:hidden"
        >
          <span className="absolute top-0 left-4 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground ring-8 ring-background lg:-top-4 lg:left-0 lg:translate-x-0">
            {index + 1}
          </span>
          <h3 className="text-lg font-extrabold text-navy lg:mt-4">{step.title}</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p>
        </article>
      ))}
    </div>
  )
}
