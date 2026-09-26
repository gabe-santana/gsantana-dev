/** @type {import('next').NextConfig} */
const cdnHost = process.env.NEXT_PUBLIC_MEDIA_CDN_URL
  ? new URL(process.env.NEXT_PUBLIC_MEDIA_CDN_URL).hostname
  : undefined;

const nextConfig = {
  // Cloudflare Pages serves the static `out/` directory produced by this.
  // No Node.js server runs in production, so every page here must be
  // statically generatable at build time.
  output: "export",
  trailingSlash: true,

  // Lets a production build run while `next dev` holds .next/ (on Windows
  // the dev server's file locks make a concurrent build fail with EPERM):
  // NEXT_DIST_DIR=.next-build npm run build. The static export then lands
  // in that folder instead of out/, so deploy it from there.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  images: {
    // The static export target has no image optimization server, so image
    // resizing/format-negotiation is delegated to the CDN in front of media
    // (Cloudflare Images / a CDN-fronted R2 bucket). See README for setup.
    unoptimized: true,
    remotePatterns: cdnHost
      ? [{ protocol: "https", hostname: cdnHost }]
      : [],
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  experimental: {
    // The app has two root layouts ("/" redirect and app/[lang]), so there's
    // no shared layout for a 404. app/global-not-found.tsx renders its own
    // <html> and becomes out/404.html, which Cloudflare serves for any
    // missing URL.
    globalNotFound: true,
  },
};

export default nextConfig;
