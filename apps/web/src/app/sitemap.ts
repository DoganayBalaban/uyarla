import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

/** Yalnızca herkese açık sayfalar. */
export default function sitemap(): MetadataRoute.Sitemap {
  const root = siteUrl()
  return [
    { url: `${root}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${root}/analyze`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${root}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${root}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${root}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ]
}
