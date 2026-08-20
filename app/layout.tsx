import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://riftbound-catalogue-prix.hydegoody.chatgpt.site"),
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
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Riftbound — Catalogue & Prix · Origins · Spiritforged · Unleashed · Vendetta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Riftbound — Catalogue & Prix",
    description:
      "Les cartes des quatre premiers sets et leurs prix Cardmarket.",
    images: ["/og.png"],
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
