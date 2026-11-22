/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Keep X-Frame-Options for older browsers that do not understand CSP.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Issue #257: enforce frame-ancestors for modern browsers via CSP.
          // Report-only first so we can confirm no first-party frames are
          // broken before promoting to Content-Security-Policy.
          // Note: a full CSP is tracked in issue #110 — the directive here is
          // intentionally minimal (frame-ancestors only) so it doesn't
          // conflict with Freighter's extension-injected scripts or the RPC
          // calls the app makes to Soroban/Horizon endpoints.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: "frame-ancestors 'none'",
          },
          // Issue #256: deny browser features the app does not use so a
          // compromised dependency or XSS cannot silently access them.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
