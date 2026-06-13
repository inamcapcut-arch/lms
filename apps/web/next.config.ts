import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Produce a minimal, self-contained server bundle for the Docker runtime image.
  output: "standalone",
};

export default nextConfig;
