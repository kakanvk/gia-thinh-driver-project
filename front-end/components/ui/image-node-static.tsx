import { NodeApi, type TCaptionProps, type TImageElement } from "platejs"
import { SlateElement, type SlateElementProps } from "platejs/static"

export function ImageElementStatic(props: SlateElementProps<TImageElement & TCaptionProps>) {
  const { caption, url, width } = props.element
  // width trong TMediaElement không có kiểu cụ thể: chỉ nhận số hoặc chuỗi
  const figureWidth = typeof width === "number" || typeof width === "string" ? width : undefined
  const captionText = caption?.length ? caption.map((node) => NodeApi.string(node)).join("") : ""
  return (
    <SlateElement {...props} className="py-2.5">
      <figure className="mx-auto my-0 max-w-full" style={{ width: figureWidth }}>
        {/* Ảnh trong bài từ API (đã nén webp): thẻ img thường vì kích thước ảnh không biết trước */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={captionText} loading="lazy" className="w-full max-w-full rounded-md object-cover" />
        {captionText ? (
          <figcaption className="mt-2 text-center text-sm text-muted-foreground">{captionText}</figcaption>
        ) : null}
      </figure>
      {props.children}
    </SlateElement>
  )
}
