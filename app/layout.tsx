import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idea Scout | 아이디어 시장 검증",
  description: "실제 웹 검색 근거로 서비스 아이디어와 경쟁 시장을 살펴보세요.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "Idea Scout",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f8fb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script src="/__preview-bridge.js" data-preview-bridge />
      </head>
      <body>{children}</body>
    </html>
  );
}
