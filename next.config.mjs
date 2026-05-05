/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage public URLs
      {
        protocol: "https",
        hostname: "rghlcnrttvlvphzahudf.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Merchant CDN hosts mirror what web/ allows; we'll surface item
      // photos in the closet view that come straight from these hosts.
      { protocol: "https", hostname: "**.amazon.com" },
      { protocol: "https", hostname: "**.media-amazon.com" },
      { protocol: "https", hostname: "**.urbndata.com" },
      { protocol: "https", hostname: "**.zara.net" },
      { protocol: "https", hostname: "**.gap.com" },
      { protocol: "https", hostname: "**.gucci.com" },
      { protocol: "https", hostname: "**.scene7.com" },
      { protocol: "https", hostname: "**.macys.com" },
      { protocol: "https", hostname: "**.aloyoga.com" },
    ],
  },
};

export default nextConfig;
// trigger: phase 1A first deploy
