<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui/runtime/types/form.js'
import * as z from 'zod'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth',
})

useSeoMeta({
  title: 'Sign up',
  description: 'Create an account to get started',
})

const toast = useToast()

const fields = [
  {
    name: 'name',
    type: 'text' as const,
    label: 'Name',
    placeholder: 'Enter your name',
  },
  {
    name: 'email',
    type: 'text' as const,
    label: 'Email',
    placeholder: 'Enter your email',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password' as const,
    placeholder: 'Enter your password',
  },
]

const providers = [
  {
    label: 'Google',
    icon: 'i-simple-icons-google',
    onClick: () => {
      toast.add({ title: 'Google', description: 'Login with Google' })
    },
  },
  {
    label: 'GitHub',
    icon: 'i-simple-icons-github',
    onClick: () => {
      toast.add({ title: 'GitHub', description: 'Login with GitHub' })
    },
  },
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters'),
})

type Schema = z.output<typeof schema>

const { signUp } = useAuth()
const router = useRouter()

// After signUp succeeds, redirect to a confirmation page where the user enters the code
async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await signUp(payload.data.name, payload.data.email, payload.data.password)
    await router.push({
      path: '/confirm',
      query: { email: payload.data.email },
    })
  } catch (err: unknown) {
    toast.add({
      title: 'Sign up failed',
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
    :providers="providers"
    title="Create an account"
    :submit="{ label: 'Create account' }"
    @submit="onSubmit"
  >
    <template #description>
      Already have an account?
      <ULink
        to="/login"
        class="text-primary font-medium"
        >Login</ULink
      >.
    </template>

    <template #footer>
      By signing up, you agree to our
      <ULink
        to="/"
        class="text-primary font-medium"
        >Terms of Service</ULink
      >.
    </template>
  </UAuthForm>
</template>
