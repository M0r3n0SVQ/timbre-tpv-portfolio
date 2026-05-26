import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "El Timbre · TPV",
    short_name: "El Timbre",
    description: "Terminal punto de venta",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#030712",
    theme_color: "#030712",
  };
}
