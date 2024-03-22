// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    "@nuxt/ui",
    "@nuxtjs/device",
    "@nuxtjs/sitemap",
    "@zadigetvoltaire/nuxt-gtm",
  ],
  site: {
    url: "https://www.justful.cn",
  },
  sitemap: {
    autoLastmod: true,
  },
  gtm: {
    id: "GTM-PBRKZL5T",
  },
})
