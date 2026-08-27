import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

/**
 * Apple's SF Pro is proprietary and cannot be served from the web, but it is
 * installed on every Apple device — so the font stack in globals.css reaches
 * for it first via `-apple-system`. Inter is the fallback everywhere else; it
 * was drawn as an SF-alike, so the two are near-indistinguishable at UI sizes.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UAV Operations Management Portal",
  description: "Fleet, pilot, compliance, and safety operations for enterprise UAV programs.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "UAV Ops", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#333f48",
  // Field crews work one-handed on a phone in gloves; pinch-zoom stays on.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
