import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tena Query Desk",
  description: "사내 데이터 조회를 위한 스키마 기반 SQL 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
