import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Third Eye — PsiLab",
    short_name: "Third Eye",
    description:
      "Daily psychic practice with honest statistics. We don't ask you to believe. We help you test.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#070b14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
