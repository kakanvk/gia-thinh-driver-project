"use client"

import * as React from "react"
import type { Value } from "platejs"
import { useRouter } from "next/navigation"
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

import { BlockquoteElement } from "@/components/ui/blockquote-node"
import { Editor, EditorContainer } from "@/components/ui/editor"
import { FixedToolbar } from "@/components/ui/fixed-toolbar"
import { H1Element, H2Element, H3Element } from "@/components/ui/heading-node"
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToolbarButton } from "@/components/ui/toolbar"
import { KEYS } from "platejs"
import { PostImageElement } from "@/components/post-image-element"
import { NEW_POST_SUBMIT_EVENT } from "@/components/new-post-header"
import { boards } from "@/lib/forum"
import { saveUserThread } from "@/lib/forum-store"

const initialValue: Value = [
  { type: "h3", children: [{ text: "Mở bài: bạn gặp tình huống gì?" }] },
  {
    type: "p",
    children: [
      {
        text: "Chia sẻ kinh nghiệm thực tế của bạn: hạng bằng, sân thi, số buổi tập…",
      },
    ],
  },
]

function valueToParagraphs(value: Value): string[] {
  return value
    .map((node: any) =>
      (node.children ?? [])
        .map((child: any) => (child.children ?? child.text ?? "").toString())
        .join("")
        .trim()
    )
    .filter(Boolean)
    .map((text: string) => text.replace(/^(H[123]:\s*)?/, ""))
}

const ALIGN_ITEMS = [
  { icon: AlignLeftIcon, value: "left", title: "Căn trái" },
  { icon: AlignCenterIcon, value: "center", title: "Căn giữa" },
  { icon: AlignRightIcon, value: "right", title: "Căn phải" },
  { icon: AlignJustifyIcon, value: "justify", title: "Căn đều" },
] as const

// Nút căn lề đơn (không dùng dropdown của Plate) để tránh lồng <button>.
function AlignButtons() {
  const { tf } = useEditorPlugin(TextAlignPlugin)
  return (
    <>
      {ALIGN_ITEMS.map(({ icon: Icon, value, title }) => (
        <ToolbarButton
          key={value}
          title={title}
          onClick={() => {
            tf.textAlign.setNodes(value)
          }}
        >
          <Icon />
        </ToolbarButton>
      ))}
    </>
  )
}

function ImageInsertButton() {
  const editor = useEditorRef()
  const fileRef = React.useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files)
      .slice(0, 4)
      .forEach((file) => {
        const reader = new FileReader()
        reader.onload = () => {
          editor.tf.insertNodes({
            type: KEYS.img,
            url: String(reader.result),
            children: [{ text: "" }],
          } as any)
          editor.tf.insertNodes({ type: "p", children: [{ text: "" }] } as any)
        }
        reader.readAsDataURL(file)
      })
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
      <ToolbarButton title="Chèn ảnh" onClick={() => fileRef.current?.click()}>
        <ImageIcon />
      </ToolbarButton>
    </>
  )
}

export function PlatePostEditor() {
  const router = useRouter()
  const [title, setTitle] = React.useState("")
  const [board, setBoard] = React.useState(boards[0]?.name ?? "Hỏi đáp chung")
  const [error, setError] = React.useState<string | null>(null)
  const [errorField, setErrorField] = React.useState<"title" | "content" | null>(null)
  const titleRef = React.useRef<HTMLInputElement>(null)

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
    value: initialValue,
  })

  function submit() {
    if (title.trim().length < 10) {
      setError("Tiêu đề cần ít nhất 10 ký tự để mọi người dễ tìm.")
      setErrorField("title")
      titleRef.current?.focus()
      return
    }
    const paragraphs = valueToParagraphs(editor.children as Value)
    if (paragraphs.length === 0) {
      setError("Nội dung bài viết đang trống, hãy viết vài dòng chia sẻ.")
      setErrorField("content")
      editor.tf.focus()
      return
    }
    setError(null)
    setErrorField(null)
    const slug = `bai-viet-${Date.now().toString(36)}`
    saveUserThread({
      slug,
      board,
      title: title.trim(),
      author: "Bạn",
      time: "Vừa xong",
      likes: 0,
      content: paragraphs,
      images: [],
      replies: [],
    })
    router.push("/thao-luan")
  }

  React.useEffect(() => {
    function onSubmit() {
      submit()
    }
    window.addEventListener(NEW_POST_SUBMIT_EVENT, onSubmit)
    return () => window.removeEventListener(NEW_POST_SUBMIT_EVENT, onSubmit)
  })

  return (
    <div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-md border border-border">
            <Plate editor={editor}>
              <FixedToolbar className="justify-start rounded-t-md border-b [&_button]:h-11 [&_button]:min-w-11 sm:[&_button]:h-8 sm:[&_button]:min-w-8">
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
              <EditorContainer className="max-h-[420px]">
                <Editor
                  placeholder="Viết nội dung bài đăng: tình huống, cách bạn xử lý, kết quả…"
                  className="px-4 pt-4 pb-72 sm:px-10"
                />
              </EditorContainer>
            </Plate>
          </div>
        </div>

        <aside className="min-w-0 rounded-md border border-border bg-card p-5">
          <label className="block">
            <span className="text-sm font-bold text-navy">
              Tiêu đề bài viết
            </span>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kinh nghiệm thi sa hình B số sàn 1 lần đậu"
              aria-invalid={errorField === "title"}
              aria-describedby={errorField === "title" ? "post-error" : undefined}
              className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 sm:text-sm"
            />
          </label>
          <span id="post-board-label" className="mt-4 block text-sm font-bold text-navy">
            Chuyên mục
          </span>
          <Select
            value={board}
            onValueChange={(v) => {
              if (typeof v === "string") setBoard(v)
            }}
          >
            <SelectTrigger
              aria-labelledby="post-board-label"
              className="mt-2 w-full rounded-md border border-border bg-background text-sm font-semibold"
              style={{ height: "3rem" }}
            >
              <SelectValue placeholder="Chọn chuyên mục" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((b) => (
                <SelectItem key={b.name} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Chọn đúng chuyên mục để bài viết đến đúng người cần đọc.
          </p>
        </aside>
      </div>

      {error ? (
        <p id="post-error" role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>
      ) : null}
    </div>
  )
}
