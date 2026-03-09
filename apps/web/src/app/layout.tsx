import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunitoFont = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Metis",
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
      </body>
    </html>
  );
}
