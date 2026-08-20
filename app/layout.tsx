import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Riftbound — Catalogue & Prix",
    template: "%s | Riftbound Catalogue",
  },
  description:
    "Les quatre premiers sets Riftbound, carte par carte, avec les prix Cardmarket normal, foil, alternatif, outnumbered et signé.",
  openGraph: {
    title: "Riftbound — Catalogue & Prix",
    description:
      "Origins, Spiritforged, Unleashed et Vendetta avec les prix Cardmarket actualisés.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Riftbound — Catalogue & Prix",
    description:
      "Les cartes des quatre premiers sets et leurs prix Cardmarket.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
