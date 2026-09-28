import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const websiteUrl = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_API_URL;

  if (!websiteUrl) {
    throw new Error("WEBSITE_URL or NEXT_PUBLIC_API_URL environment variable is required");
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/meet/", "/api/"],
      },
    ],
    sitemap: `${websiteUrl}/sitemap.xml`,
  };
}
