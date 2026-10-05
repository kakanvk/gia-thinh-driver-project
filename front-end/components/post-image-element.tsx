'use client';

import { PlateElement, type PlateElementProps } from 'platejs/react';

import { Caption, CaptionTextarea } from '@/components/ui/caption';

export function PostImageElement(props: PlateElementProps) {
  const { url, caption } = props.element as {
    url?: string;
    caption?: { text?: string }[];
  };
  // alt lấy theo chú thích ảnh (ảnh trong bài admin đến từ kho media, không còn base64)
  const alt =
    caption?.map((node) => node.text ?? '').join('').trim() ||
    'Ảnh minh họa bài viết';

  return (
    <PlateElement {...props} className="my-3">
      <span
        contentEditable={false}
        className="block overflow-hidden rounded-md border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="w-full object-cover" />
      </span>
      <Caption align="center">
        <CaptionTextarea placeholder="Viết chú thích cho ảnh (không bắt buộc)…" />
      </Caption>
      {props.children}
    </PlateElement>
  );
}
