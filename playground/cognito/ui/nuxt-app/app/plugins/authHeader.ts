import { useAuth } from '~/composables/useAuth'

export default defineNuxtPlugin(() => {
  const { getAccessToken } = useAuth()

  const $api = $fetch.create({
    baseURL: useRuntimeConfig().public.apiBaseUrl,
    async onRequest({ options }) {
      const token = await getAccessToken()
      if (token) {
        const headers = new Headers(options.headers as HeadersInit)
        headers.set('Authorization', `Bearer ${token}`)
        options.headers = headers
      }
    },
  })

  return {
    provide: {
      api: $api,
    },
  }
})
