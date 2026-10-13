import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldOps BD — Field Service Management for Bangladesh",
  description:
    "Mobile-first, multi-tenant field-service management platform tailored for AC and refrigeration servicing companies in Bangladesh.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
