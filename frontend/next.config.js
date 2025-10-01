/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        // Optionally stub konva to ensure no server-side imports
        konva: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
