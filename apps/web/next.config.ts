import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@victor/shared', '@victor/core'],
};

export default nextConfig;
