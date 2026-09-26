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
};

export default nextConfig;
