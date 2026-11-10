//@ts-check
const path = require("path");
const { composePlugins, withNx } = require("@nx/next");

// next-intl's request config, wired for both bundlers by hand: Turbopack wants
// a project-relative specifier, webpack an absolute path, and the official
// plugin picks its branch from an env var Nx has not set yet when this file
// is evaluated.
const i18nRequestPath = "./src/i18n/request.ts";
const i18nRequestAbsolute = path.join(__dirname, i18nRequestPath).replace(/\\/g, "/");

/** @param {import('@nx/next/plugins/with-nx').WithNxOptions} nextConfig */
function withNextIntl(nextConfig) {
  const originalWebpack = nextConfig.webpack;
  return {
    ...nextConfig,
    turbopack: {
      ...nextConfig.turbopack,
      resolveAlias: { ...nextConfig.turbopack?.resolveAlias, "next-intl/config": i18nRequestPath },
    },
    webpack(config, options) {
      config.resolve.alias["next-intl/config"] = i18nRequestAbsolute;
      return typeof originalWebpack === "function" ? originalWebpack(config, options) : config;
    },
  };
}

/** @type {import('@nx/next/plugins/with-nx').WithNxOptions} */
const nextConfig = {
  nx: {},
  transpilePackages: ["utils", "components", "assets", "services", "models", "dtos", "enums"],
  output: "standalone",
  images: {
    // Add the hosts the project serves images from.
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

module.exports = composePlugins(withNx, withNextIntl)(nextConfig);
