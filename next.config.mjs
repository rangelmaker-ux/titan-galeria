/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: process.env.R2_PUBLIC_HOSTNAME || "placeholder.example.com",
      },
    ],
  },
};

export default nextConfig;
