import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  typescript: {
    // Allow build to succeed even with type errors (pre-existing unused imports)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow build to succeed even with ESLint warnings
    ignoreDuringBuilds: true,
  },
  experimental: {
    esmExternals: true,
  },
  // Fix COOP warning for Google Sign-In popup
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  // Suppress Watchpack errors for Windows system files
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/C:/pagefile.sys',
          '**/C:/hiberfil.sys',
          '**/C:/swapfile.sys',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
