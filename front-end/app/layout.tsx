import type { Metadata } from "next"
import { Be_Vietnam_Pro, Geist_Mono, Oooh_Baby, Inter } from "next/font/google"

import "./globals.css"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const fontHand = Oooh_Baby({
  subsets: ["vietnamese", "latin"],
  weight: ["400"],
  variable: "--font-hand",
})

export const metadata: Metadata = {
  title: "Trường lái Gia Thịnh | Đào tạo lái xe máy & ô tô",
  description:
    "Đào tạo bằng lái A1, A và B với học phí minh bạch, lịch học linh hoạt và giáo viên theo sát từng buổi.",
  icons: {
    icon: "/giathinh-logo.png",
    apple: "/giathinh-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, fontHand.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider forcedTheme="light" enableSystem={false}>
          {children}
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}
