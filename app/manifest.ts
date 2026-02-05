import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ApplyFlow",
    short_name: "ApplyFlow",
    description:
      "AI-powered job application workspace for profile building, tailored packs, and application tracking.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf8f0",
    theme_color: "#0b8cac",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
