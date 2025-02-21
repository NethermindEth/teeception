import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer, dev }) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

export default nextConfig;
