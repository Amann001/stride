import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/lib/auth";

// Archivo: a sporty grotesque with a width axis, so headlines can run wide like a race bib
// while body text stays at normal width. One family, two jobs.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
});

const TITLE = "Stride: free, private tracking for runs, rides, walks and hikes";
const DESCRIPTION =
  "Record runs, rides, walks and hikes with GPS, follow friends, join challenges and clubs. Free, private, on Android, iPhone and the web.";

// The preview card (app/opengraph-image.jpg) is what LinkedIn, WhatsApp and X show for a link.
export const metadata: Metadata = {
  metadataBase: new URL("https://stride-amanswamy.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: "Stride: Every stride counts.", description: DESCRIPTION, url: "/", siteName: "Stride", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: "Stride: Every stride counts.", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#121212",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
