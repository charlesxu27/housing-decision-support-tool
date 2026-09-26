import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PGH Housing Advisor",
  description:
    "Click a Pittsburgh parcel to see which housing types make sense — and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
