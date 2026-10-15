import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "天梯赛实时大屏 - 华北水利水电大学",
  description: "华北水利水电大学天梯赛实时分数展示系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={["light", "dark", "emerald", "violet"]}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
