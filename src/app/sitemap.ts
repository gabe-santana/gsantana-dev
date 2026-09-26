import type { MetadataRoute } from "next";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";

export const dynamic = "force-static";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gsantana.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/blog", "/principles", "/about"].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }));

  const postRoutes = getAllPostSummaries().map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: post.date,
  }));

  // Placeholder principles are built but kept out of the sitemap.
  const principleRoutes = getAllPrinciples()
    .filter((principle) => !principle.isWip)
    .map((principle) => ({ url: `${siteUrl}${principle.href}` }));

  return [...staticRoutes, ...postRoutes, ...principleRoutes];
}
