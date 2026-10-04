import Image from "next/image"
import { NodeApi, type TCaptionProps, type TImageElement } from "platejs"
import { SlateElement, type SlateElementProps } from "platejs/static"

export function ImageElementStatic(
  props: SlateElementProps<TImageElement & TCaptionProps>
) {
  const { caption, url, width } = props.element
  // width trong TMediaElement không có kiểu cụ thể: chỉ nhận số hoặc chuỗi
  const figureWidth =
    typeof width === "number" || typeof width === "string" ? width : undefined
  const captionText = caption?.length
    ? caption.map((node) => NodeApi.string(node)).join("")
    : ""
  return (
    <SlateElement {...props} className="py-2.5">
      {/* next/image không nhận src rỗng: node ảnh thiếu url thì bỏ qua khung ảnh */}
      {url ? (
        <figure
          className="mx-auto my-0 max-w-full"
          style={{ width: figureWidth }}
        >
          {/* Ảnh trong bài từ API (đã nén webp): next/image unoptimized; kích thước không biết trước
            nên width/height = 0 và để CSS (w-full h-auto) giữ đúng tỉ lệ ảnh gốc */}
          <Image
            src={url}
            alt={captionText}
            width={0}
            height={0}
            unoptimized
            sizes="(max-width: 1024px) 100vw, 800px"
            className="h-auto w-full max-w-full rounded-md object-cover"
          />
          {captionText ? (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">
              {captionText}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      {props.children}
    </SlateElement>
  )
}
