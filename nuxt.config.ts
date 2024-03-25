// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  router: {
    options: {
      strict: false,
    },
  },
  modules: [
    "@nuxt/ui",
    "@nuxtjs/device",
    "@nuxtjs/sitemap",
    "@zadigetvoltaire/nuxt-gtm",
  ],
  site: {
    url: "https://www.justful.cn",
    trailingSlash: true,
  },
  sitemap: {
    autoLastmod: true,
  },
  gtm: {
    id: "GTM-PBRKZL5T",
  },
  experimental: {
    defaults: {
      nuxtLink: {
        trailingSlash: "append", // can be 'append' or 'remove'
      },
    },
  },
})
