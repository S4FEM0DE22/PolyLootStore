import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    }];
  },
};

export default nextConfig;
