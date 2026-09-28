import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error("WEBSITE_URL or NEXT_PUBLIC_API_URL environment variable is required");
  }

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
