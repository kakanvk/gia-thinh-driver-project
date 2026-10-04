// Kiểu phản hồi của /api/v1/public/* (back-end/src/modules/public)
export type PublicImage = { url: string; alt: string }

export type PublicSettings = Partial<{
  hotline: string
  zaloOa: string
  supportEmail: string
  socials: { label: string; url: string }[]
  registerNotes: string[]
  consultationContactTimes: { label: string; value: string }[]
}>

export type PublicBranch = {
  id: string
  name: string
  slug: string
  officeName: string
  address: string
  mapUrl?: string | null
  phone?: string | null
  openingHours?: string | null
  order: number
}

export type VehicleType = "moto" | "car" | "truck"

export type PricingItem = {
  key: string
  label: string
  amount: number | null
  amountMax: number | null
  unit: string | null
  note: string | null
}

// API không trả `order`: các gói đã được sắp theo thứ tự hiển thị trong từng chi nhánh
export type PricingCourse = {
  code: string
  name: string
  vehicleType: VehicleType
  description: string | null
  duration: string | null
  image: PublicImage | null
  price: number
  priceNote: string | null
  fees: PricingItem[]
  discounts: PricingItem[]
}

export type BranchPricing = {
  branch: { name: string; slug: string; officeName: string; address: string }
  courses: PricingCourse[]
}

export type UpcomingClass = {
  code: string
  course: { code: string; name: string }
  transmission: "manual" | "automatic" | null
  branch: { name: string; slug: string }
  startDate: string
  endDate: string
  scheduleText: string
  seatsLeft: number
  status: "enrolling" | "upcoming"
}

export type UpcomingExam = {
  type: "graduation" | "official"
  course: { code: string; name: string }
  branch: { name: string; slug: string }
  date: string
  location: string | null
}

export type PublicCategory = {
  name: string
  slug: string
  description: string | null
  isAnnouncement: boolean
  postCount: number
}

export type PostSummary = {
  slug: string
  title: string
  excerpt: string
  cover: PublicImage | null
  tags: string[]
  authorName: string
  publishedAt: string
  readTimeMinutes: number
  views: number
  category: { name: string; slug: string; isAnnouncement: boolean } | null
}

export type PostDetail = PostSummary & { content: unknown[] }

export type PageMeta = { page: number; limit: number; total: number }
