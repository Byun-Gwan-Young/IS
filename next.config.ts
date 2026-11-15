import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["*.jitda.io"],
  devIndicators: false,
};

export default nextConfig;
