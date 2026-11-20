import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// next dev でも Cloudflare の環境を使えるようにする
initOpenNextCloudflareForDev();
