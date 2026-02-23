import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PRISM Genomics",
  description:
    "Decentralized AI-Powered Genomic Data Ownership & Risk Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Web3Provider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Toaster richColors position="bottom-right" />
        </Web3Provider>
      </body>
    </html>
  );
}
