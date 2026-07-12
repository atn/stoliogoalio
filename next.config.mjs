/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.contentapi.ea.com' },
      { protocol: 'https', hostname: 'proclubs.ea.com' },
      { protocol: 'https', hostname: '**.ea.com' },
    ],
  },
};

export default nextConfig;
