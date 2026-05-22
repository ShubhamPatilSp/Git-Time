/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['simple-git', 'adm-zip', 'fs-extra']
  }
}

module.exports = nextConfig
