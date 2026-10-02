'use client';

import { PlateElement, type PlateElementProps } from 'platejs/react';

import { Caption, CaptionTextarea } from '@/components/ui/caption';

export function PostImageElement(props: PlateElementProps) {
  const { url } = props.element as { url?: string };

  return (
    <PlateElement {...props} className="my-3">
      <span
        contentEditable={false}
        className="block overflow-hidden rounded-md border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Ảnh minh họa bài viết" className="w-full object-cover" />
      </span>
      <Caption align="center">
        <CaptionTextarea placeholder="Viết chú thích cho ảnh (không bắt buộc)…" />
      </Caption>
      {props.children}
    </PlateElement>
  );
}
