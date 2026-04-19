<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: false,
})

const { signOut } = useAuth()
const { clear } = useCurrentUser()

onMounted(async () => {
  await signOut()
  clear()
  await navigateTo('/')
})
</script>

<template>
  <div />
</template>
