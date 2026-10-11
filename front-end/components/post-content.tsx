import { BaseTextAlignPlugin } from "@platejs/basic-styles"
import { BaseCaptionPlugin } from "@platejs/caption"
import { BaseLinkPlugin } from "@platejs/link"
import { BaseListPlugin, isOrderedList } from "@platejs/list"
import { BaseImagePlugin } from "@platejs/media"
import { KEYS, type RenderStaticNodeWrapper, type TListElement, type Value } from "platejs"
import { createStaticEditor, PlateStatic, type SlateRenderElementProps } from "platejs/static"

import { BaseBasicBlocksKit } from "@/components/editor/plugins/basic-blocks-base-kit"
import { BaseBasicMarksKit } from "@/components/editor/plugins/basic-marks-base-kit"
import { ImageElementStatic } from "@/components/ui/image-node-static"
import { LinkElementStatic } from "@/components/ui/link-node-static"

// BlockListStatic dùng chung chỉ bọc danh sách có số; bài viết cần cả danh sách chấm (disc, circle…)
function PostList(props: SlateRenderElementProps) {
  const { indent, listStart, listStyleType } = props.element as TListElement & { indent?: number }
  const Tag = isOrderedList(props.element) ? "ol" : "ul"
  return (
    <Tag
      className="relative m-0 p-0"
      style={{ listStyleType: listStyleType === "todo" ? "none" : listStyleType, marginLeft: indent ? `${indent * 24}px` : undefined }}
      start={listStart}
    >
      <li>{props.children}</li>
    </Tag>
  )
}

const PostListStatic: RenderStaticNodeWrapper = (props) => {
  if (!props.element.listStyleType) return
  return PostList
}

// Plugin render tĩnh cho nội dung bài viết soạn ở admin (Plate JSON từ API)
const plugins = [
  ...BaseBasicBlocksKit,
  ...BaseBasicMarksKit,
  BaseTextAlignPlugin.configure({
    inject: { nodeProps: { defaultNodeValue: "start", nodeKey: "align" }, targetPlugins: [...KEYS.heading, KEYS.p, KEYS.img] },
  }),
  BaseListPlugin.configure({
    inject: { targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote] },
    render: { belowNodes: PostListStatic },
  }),
  BaseLinkPlugin.withComponent(LinkElementStatic),
  BaseImagePlugin.withComponent(ImageElementStatic),
  BaseCaptionPlugin.configure({ options: { query: { allow: [KEYS.img] } } }),
]

export function PostContent({ value }: { value: unknown[] }) {
  const editor = createStaticEditor({ plugins, value: value as Value })
  return <PlateStatic editor={editor} className="flex flex-col gap-5 leading-7 text-foreground/85 sm:leading-8" />
}
