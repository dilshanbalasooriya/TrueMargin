import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const envAllowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const defaultDevOrigins = ['localhost', '127.0.0.1'];
const allowedDevOrigins = Array.from(new Set([...defaultDevOrigins, ...envAllowedDevOrigins]));

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
