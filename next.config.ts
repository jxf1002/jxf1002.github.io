import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // GitHub Pages 托管，输出纯静态；trailingSlash 保证 /college/ 这类 URL 与旧站一致
  output: "export",
  trailingSlash: true,
}

export default nextConfig
