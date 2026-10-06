import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "STC FoundIt",
  description: "Kasdi Merbah lost-and-found network",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
