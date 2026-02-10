/** @type {import('@remix-run/dev').AppConfig} */
const config = {
  ignoredRouteFiles: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*"],
  serverModuleFormat: "cjs",
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    unstable_singleFetch: true
  }
};
module.exports = config;
