"use client"

import { useEffect } from "react"

import { ScrollReveal } from "@/components/scroll-reveal"
import { Badge } from "@/components/ui/badge"
import {
  TIKTOK_HANDLE,
  TIKTOK_PROFILE_URL,
  TIKTOK_VIDEOS,
} from "@/lib/tiktok"

let embedScriptLoaded = false

function loadTikTokEmbed() {
  if (embedScriptLoaded) return
  embedScriptLoaded = true
  const script = document.createElement("script")
  script.src = "https://www.tiktok.com/embed.js"
  script.async = true
  document.body.appendChild(script)
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  )
}

export function TikTokSection() {
  useEffect(() => {
    if (TIKTOK_VIDEOS.length > 0) loadTikTokEmbed()
  }, [])

  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ScrollReveal className="max-w-2xl">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-5">
              <TikTokIcon className="size-3.5" />
              TikTok
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Xem Gia Thịnh trên TikTok
            </h2>
          </div>
        </ScrollReveal>

        {TIKTOK_VIDEOS.length > 0 ? (
          <div className="mt-12 grid justify-items-center gap-6 md:grid-cols-2 lg:grid-cols-3">
            {TIKTOK_VIDEOS.slice(0, 3).map((video) => (
              <ScrollReveal key={video.id} className="w-full max-w-[380px]">
                <blockquote
                  className="tiktok-embed"
                  cite={video.url}
                  data-video-id={video.id}
                  style={{ maxWidth: "605px", minWidth: "min(325px, 100%)" }}
                >
                  <section>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      title={TIKTOK_HANDLE}
                      href={TIKTOK_PROFILE_URL}
                    >
                      {TIKTOK_HANDLE}
                    </a>
                  </section>
                </blockquote>
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <ScrollReveal className="mt-12">
            <a
              href={TIKTOK_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-4 rounded-md border border-border bg-card p-6 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:gap-5 sm:p-8"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-black text-white">
                <TikTokIcon className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold break-all text-navy group-hover:text-primary">
                  {TIKTOK_HANDLE}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  Bấm để xem toàn bộ video mới nhất trên kênh TikTok của trung tâm.
                </span>
              </span>
              <span className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-black px-6 text-sm font-bold text-white sm:w-auto">
                <TikTokIcon className="size-4" />
                Theo dõi kênh
              </span>
            </a>
          </ScrollReveal>
        )}
      </div>
    </section>
  )
}
