import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한 장 신문",
  description: "기사와 사진을 편집해 A4 한 장 PDF로 만드는 아침활동 편집실.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
