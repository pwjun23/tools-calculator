import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://tools.molespapa.com";
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
    },
    ...TOOLS.map((tool) => ({
      url: `${baseUrl}${tool.href}`,
      lastModified,
    })),
  ];
}
