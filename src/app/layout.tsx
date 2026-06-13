import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Kronix E-sports | Plataforma de Torneos",
    template: "%s | Kronix E-sports"
  },
  description: "La plataforma líder de torneos y rankings de E-sports en República Dominicana. Compite en salas personalizadas, torneos de streamers y escala en el ranking nacional.",
  keywords: ["Kronix", "Esports", "Torneos", "Clash Royale", "Leaderboard", "Dominican Republic", "República Dominicana", "Gaming"],
  metadataBase: new URL("https://www.kronix.do"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
