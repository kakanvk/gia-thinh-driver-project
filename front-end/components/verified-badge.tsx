import Image from "next/image"

import { cn } from "@/lib/utils"

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Image
      src="/verify-checked.png"
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      className={cn("size-4 shrink-0", className)}
    />
  )
}
