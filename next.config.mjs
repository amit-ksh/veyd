/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/projects/*/handbook.pdf": ["./public/fonts/*.ttf"],
      "/api/projects/*/handbook.html": [
        "./src/lib/handbook/reader.css",
        "./src/lib/handbook/offline-reader.js",
      ],
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/chat",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
