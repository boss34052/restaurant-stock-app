import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily Stock Count — ร้านสุกี้ลิ้นชา",
  description: "นับ Stock ตอนปิดร้าน ส่งเข้า LINE, Google Sheet และ Google Docs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
