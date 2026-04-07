import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "katex/dist/katex.min.css";

const nunitoFont = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Umenti",
  description: "The learning platform of the AI era.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={nunitoFont.className}
      >
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
