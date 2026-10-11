import { StickyHeader } from "@/components/sticky-header"
import { getSiteContact } from "@/lib/api/public"

// Header client cần hotline: lấy ở server (ISR) rồi truyền xuống
export async function SiteHeader() {
  const contact = await getSiteContact()
  return <StickyHeader contact={{ hotline: contact.hotline, telHref: contact.telHref }} />
}
