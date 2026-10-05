"use client"

import * as React from "react"
import type { Value } from "platejs"
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ImageIcon,
} from "lucide-react"
import {
  BlockquotePlugin,
  BoldPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react"
import { TextAlignPlugin } from "@platejs/basic-styles/react"
import { CaptionPlugin } from "@platejs/caption/react"
import { ImagePlugin } from "@platejs/media/react"
import {
  Plate,
  useEditorPlugin,
  useEditorRef,
  usePlateEditor,
} from "platejs/react"
import { KEYS } from "platejs"

import { MediaPicker } from "@/components/admin/media/media-picker"
import { PostImageElement } from "@/components/post-image-element"
import { BlockquoteElement } from "@/components/ui/blockquote-node"
import { Editor, EditorContainer } from "@/components/ui/editor"
import { FixedToolbar } from "@/components/ui/fixed-toolbar"
import { H1Element, H2Element, H3Element } from "@/components/ui/heading-node"
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button"
import { Separator } from "@/components/ui/separator"
import { ToolbarButton } from "@/components/ui/toolbar"
import type { MediaItem } from "@/lib/admin/types"
import { cn } from "@/lib/utils"

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }]

const alignItems = [
  { icon: AlignLeftIcon, value: "left", title: "Căn trái" },
  { icon: AlignCenterIcon, value: "center", title: "Căn giữa" },
  { icon: AlignRightIcon, value: "right", title: "Căn phải" },
  { icon: AlignJustifyIcon, value: "justify", title: "Căn đều" },
] as const

function AlignButtons() {
  const { tf } = useEditorPlugin(TextAlignPlugin)

  return (
    <>
      {alignItems.map(({ icon: Icon, value, title }) => (
        <ToolbarButton
          key={value}
          title={title}
          onClick={() => tf.textAlign.setNodes(value)}
        >
          <Icon />
        </ToolbarButton>
      ))}
    </>
  )
}

// Ảnh trong nội dung chỉ lấy từ kho media (backend từ chối data: URL và
// kiểm mediaId tồn tại khi lưu bài)
function ImageInsertButton() {
  const editor = useEditorRef()
  const [open, setOpen] = React.useState(false)

  function insertImage(media: MediaItem) {
    editor.tf.insertNodes(
      [
        {
          type: KEYS.img,
          url: media.url,
          mediaId: media.id,
          caption: [{ text: "" }],
          children: [{ text: "" }],
        },
        { type: "p", children: [{ text: "" }] },
      ] as never,
      { select: true }
    )
  }

  return (
    <>
      <ToolbarButton
        title="Chèn ảnh"
        aria-label="Chèn ảnh"
        onClick={() => setOpen(true)}
      >
        <ImageIcon />
      </ToolbarButton>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind="image"
        title="Chèn ảnh vào bài viết"
        onSelect={insertImage}
      />
    </>
  )
}

type AdminPostEditorProps = {
  value: Value
  onChange: (value: Value) => void
  invalid?: boolean
}

export function AdminPostEditor({
  value,
  onChange,
  invalid = false,
}: AdminPostEditorProps) {
  // Giá trị editor phát ra gần nhất: value khác nó nghĩa là form đặt lại từ ngoài
  const emitted = React.useRef<Value>(value)
  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      H1Plugin.withComponent(H1Element),
      H2Plugin.withComponent(H2Element),
      H3Plugin.withComponent(H3Element),
      BlockquotePlugin.withComponent(BlockquoteElement),
      TextAlignPlugin,
      ImagePlugin.withComponent(PostImageElement),
      CaptionPlugin,
    ],
    value: value.length > 0 ? value : EMPTY_VALUE,
  })

  React.useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    editor.tf.setValue(value.length > 0 ? value : EMPTY_VALUE)
  }, [editor, value])

  return (
    <div
      data-invalid={invalid}
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20"
      )}
    >
      <Plate
        editor={editor}
        onValueChange={({ value: next }) => {
          emitted.current = next
          onChange(next)
        }}
      >
        <FixedToolbar className="justify-start rounded-none">
          <ToolbarButton
            title="Tiêu đề lớn"
            onClick={() => editor.tf.h1.toggle()}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            title="Tiêu đề vừa"
            onClick={() => editor.tf.h2.toggle()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            title="Tiêu đề nhỏ"
            onClick={() => editor.tf.h3.toggle()}
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            title="Trích dẫn"
            onClick={() => editor.tf.blockquote.toggle()}
          >
            Quote
          </ToolbarButton>
          <MarkToolbarButton nodeType="bold" title="Đậm">
            B
          </MarkToolbarButton>
          <MarkToolbarButton nodeType="italic" title="Nghiêng">
            I
          </MarkToolbarButton>
          <MarkToolbarButton nodeType="underline" title="Gạch chân">
            U
          </MarkToolbarButton>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <AlignButtons />
          <Separator orientation="vertical" className="mx-1 h-6" />
          <ImageInsertButton />
        </FixedToolbar>
        <EditorContainer className="max-h-140 min-h-80">
          <Editor
            variant="none"
            aria-invalid={invalid}
            aria-describedby={invalid ? "post-content-error" : undefined}
            placeholder="Bắt đầu viết nội dung bài viết..."
            className="min-h-80 px-4 py-3 text-[13px] leading-6"
          />
        </EditorContainer>
      </Plate>
    </div>
  )
}
