import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://tools.molespapa.com";
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
    },
    {
      url: `${baseUrl}/freelancer`,
      lastModified,
    },
    {
      url: `${baseUrl}/salary`,
      lastModified,
    },
    {
      url: `${baseUrl}/car`,
      lastModified,
    },
    {
      url: `${baseUrl}/jeonse`,
      lastModified,
    },
    {
      url: `${baseUrl}/jeonse-vs-loan`,
      lastModified,
    },
  ];
}
