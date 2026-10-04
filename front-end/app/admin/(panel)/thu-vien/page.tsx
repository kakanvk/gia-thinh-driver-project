import type { Metadata } from "next"

import { AdminPageHeader } from "@/components/admin/admin-ui"
import { GalleryManager } from "@/components/admin/gallery/gallery-manager"
import { MediaLibrary } from "@/components/admin/gallery/media-library"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "Thư viện",
}

export default function GalleryPage() {
  return (
    <main id="admin-content" className="p-4">
      <AdminPageHeader title="Thư viện" />
      <Tabs defaultValue="gallery" className="mt-4 gap-4">
        <TabsList>
          <TabsTrigger value="gallery">Thư viện website</TabsTrigger>
          <TabsTrigger value="media">Kho media</TabsTrigger>
        </TabsList>
        <TabsContent value="gallery">
          <GalleryManager />
        </TabsContent>
        <TabsContent value="media">
          <MediaLibrary />
        </TabsContent>
      </Tabs>
    </main>
  )
}
