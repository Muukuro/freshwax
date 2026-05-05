import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Freshwax",
    short_name: "Freshwax",
    description: "A self-hosted music release tracker for personal artist watchlists.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#08111b",
    theme_color: "#08111b",
    categories: ["music", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Recent releases",
        short_name: "Recent",
        url: "/recent",
        description: "Open the recent-release feed.",
      },
      {
        name: "Upcoming releases",
        short_name: "Upcoming",
        url: "/upcoming",
        description: "Open future-dated releases.",
      },
      {
        name: "Artists",
        short_name: "Artists",
        url: "/artists",
        description: "Search and manage followed artists.",
      },
    ],
  };
}
