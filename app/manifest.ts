import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leyrd — layer coach",
    short_name: "Leyrd",
    description: "How many layers to wear today, from your forecast and your own wardrobe.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#2f5d50",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
