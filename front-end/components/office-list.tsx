import { Building2, ChevronRight } from "lucide-react"

import type { PublicBranch } from "@/lib/public/types"

function OfficeBody({ branch }: { branch: PublicBranch }) {
  return (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Building2 aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-navy">{branch.officeName}</span>
        <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">{branch.address}</span>
      </span>
    </>
  )
}

const cardClass =
  "group flex flex-1 items-center gap-4 rounded-md border border-primary/15 bg-background px-5 py-4"

export function OfficeList({ branches }: { branches: PublicBranch[] | null }) {
  if (!branches?.length) {
    return (
      <p className="rounded-md border border-primary/15 bg-background px-5 py-4 text-sm text-muted-foreground">
        Danh sách văn phòng đang được cập nhật, vui lòng gọi hotline để được hướng dẫn.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {branches.map((branch) =>
        branch.mapUrl ? (
          <a
            key={branch.slug}
            href={branch.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Xem bản đồ ${branch.officeName}`}
            className={`${cardClass} transition-colors hover:border-primary/40 hover:bg-primary/[0.04]`}
          >
            <OfficeBody branch={branch} />
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
            />
          </a>
        ) : (
          <div key={branch.slug} className={cardClass}>
            <OfficeBody branch={branch} />
          </div>
        )
      )}
    </div>
  )
}
