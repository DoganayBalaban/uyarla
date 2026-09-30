import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

/** Kullanıcıya özel ekranlar ve API taranmıyor; zaten oturum istiyorlar. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/adapt/", "/account", "/applications", "/test"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
