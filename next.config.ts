import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/words': ['./JACET8000_意味ジャンル×レベル別.xlsx'],
    '/api/game':  ['./JACET8000_意味ジャンル×レベル別.xlsx'],
  },
};

export default nextConfig;
