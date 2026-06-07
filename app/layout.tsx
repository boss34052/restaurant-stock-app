import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Stock Count",
  description: "นับ Stock ตอนปิดร้าน ส่งเข้า LINE, Google Sheet และ Google Docs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
