import { Fragment } from "react"

import { splitByQuery } from "@/lib/news"

/** Tô sáng các đoạn văn bản khớp với từ khoá tìm kiếm (không phân biệt dấu). */
export function HighlightMatch({ text, query }: { text: string; query?: string }) {
  const trimmedQuery = query?.trim() ?? ""
  if (!trimmedQuery) return <>{text}</>

  return (
    <>
      {splitByQuery(text, trimmedQuery).map((segment, index) =>
        segment.match ? (
          <mark
            key={index}
            className="rounded-sm bg-highlight/70 px-0.5 text-navy dark:text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  )
}
