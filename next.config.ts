import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // GitHub Pages 托管，输出纯静态；trailingSlash 保证 /college/ 这类 URL 与旧站一致
  output: "export",
  trailingSlash: true,
  // 手机用局域网 IP 打开 dev 服务器时，Next 会拦非本机来源的 /_next 资源（只影响开发；
  // 静态导出无此限制），放行内网网段与本机回环，免得换台机器/换 IP 又打不开
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*"],
}

export default nextConfig
