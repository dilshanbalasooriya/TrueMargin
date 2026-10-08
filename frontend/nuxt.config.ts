// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase', '@pinia/nuxt', '@nuxtjs/tailwindcss', '@vueuse/nuxt/module'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true }
})
