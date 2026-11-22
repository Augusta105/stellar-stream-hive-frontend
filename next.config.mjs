/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep the Stellar SDK out of server-side route bundles; it is large and
  // only needed at runtime in wallet-action paths (transaction building,
  // contract simulation). Next.js will require() it from node_modules at
  // runtime instead of inlining it.
  serverExternalPackages: ['@stellar/stellar-sdk'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  // Issue #110: a Content-Security-Policy is deliberately not set here — it
  // needs a separate review because of Freighter (extension-injected script)
  // and the RPC calls this app makes to Soroban/Horizon endpoints.
};

export default nextConfig;
