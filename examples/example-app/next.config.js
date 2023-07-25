const createNextPluginPreval = require('@sweetsideofsweden/next-plugin-preval/config');
const withNextPluginPreval = createNextPluginPreval();

module.exports = withNextPluginPreval({
  eslint: {
    ignoreDuringBuilds: true,
  },
});
