// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@nuxt/ui", "@nuxtjs/device", "@nuxtjs/sitemap"],
  site: {
    url: "https://www.justful.cn",
  },
  sitemap: {
    autoLastmod: true,
  },
})
