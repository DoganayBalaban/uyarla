import type { MetadataRoute } from "next"
import { siteAdresi } from "@/lib/site"

/** Yalnızca herkese açık sayfalar. */
export default function sitemap(): MetadataRoute.Sitemap {
  const kok = siteAdresi()
  return [
    { url: `${kok}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${kok}/analyze`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${kok}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${kok}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${kok}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ]
}
