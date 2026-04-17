<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui/runtime/types/form.js'
import * as z from 'zod'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth',
})

useSeoMeta({
  title: 'Confirm your account',
  description: 'Enter the confirmation code sent to your email',
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const email = computed(() => (route.query.email as string) || '')

const fields = [
  {
    name: 'code',
    type: 'text' as const,
    label: 'Confirmation code',
    placeholder: 'Enter the 6-digit code',
  },
]

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
})

type Schema = z.output<typeof schema>

const { confirmSignUp } = useAuth()

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await confirmSignUp(email.value, payload.data.code)
    toast.add({ title: 'Account confirmed', description: 'You can now log in.' })
    await router.push({ path: '/login', query: { email: email.value } })
  } catch (err: unknown) {
    toast.add({
      title: 'Confirmation failed',
      description: err instanceof Error ? err.message : String(err),
      color: 'error',
    })
  }
}
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    title="Confirm your account"
    icon="i-lucide-mail-check"
    :submit="{ label: 'Confirm' }"
    @submit="onSubmit"
  >
    <template #description>
      We sent a code to <strong>{{ email }}</strong
      >. Check your inbox and enter it below.
    </template>

    <template #footer>
      Didn't receive a code?
      <ULink
        to="/signup"
        class="text-primary font-medium"
        >Sign up again</ULink
      >.
    </template>
  </UAuthForm>
</template>
