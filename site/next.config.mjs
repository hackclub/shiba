/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable Next.js dev UI indicators
  devIndicators: false,
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
    return [
      {
        source: "/api/uploadGame",
        destination: `${apiBase.replace(/\/$/, "")}/api/uploadGame`,
      },
      {
        source: "/play/:path*",
        destination: `${apiBase.replace(/\/$/, "")}/api/play/:path*`,
      }
    ];
  },
};

export default nextConfig;
