/** @type {import('next').NextConfig} */
const nextConfig = {
  // archiver (usado no download de galerias em .zip — ver
  // src/app/api/g/[token]/download/route.ts) tem um "exports" no
  // package.json que o bundler do webpack não resolve direto; isso diz pro
  // Next pra não tentar empacotar e deixar o require nativo do Node
  // resolver em runtime, que funciona sem problema.
  experimental: {
    serverComponentsExternalPackages: ["archiver"],
  },
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
