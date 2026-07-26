import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "رکاد | مدیریت تسک",
  description: "سیستم مدیریت تسک باشگاه کسب‌وکار رکاد",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
