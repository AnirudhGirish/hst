import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "HST",
  description: "Hardware Secure Server",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
