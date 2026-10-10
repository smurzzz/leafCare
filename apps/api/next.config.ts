import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `@leafcare/shared` is a workspace package (see packages/shared) built to
  // dist/ on install; both the app and the API import the same contracts.
  transpilePackages: ['@leafcare/shared'],
  serverExternalPackages: ['@supabase/supabase-js'],
};

export default nextConfig;
