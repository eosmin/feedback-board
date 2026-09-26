import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // No `/[locale]` segment exists in this app (TDD §2.6.13) — the plugin only wires the
  // request-config lookup, it does not add routing.
};

const withNextIntl = createNextIntlPlugin({
  experimental: { createMessagesDeclaration: './messages/en.json' },
});

export default withNextIntl(nextConfig);
