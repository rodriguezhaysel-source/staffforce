/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.CAPACITOR_BUILD === 'true' && {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
  })
}
module.exports = nextConfig
