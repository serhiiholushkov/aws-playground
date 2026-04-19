<script setup lang="ts">
const route = useRoute()
const { user, refresh } = useCurrentUser()

onMounted(refresh)

const userMenuItems = [
  [
    {
      label: 'Log out',
      icon: 'i-lucide-log-out',
      to: '/logout',
    },
  ],
]

const items = computed(() => [
  {
    label: 'Docs',
    to: '/docs',
    active: route.path.startsWith('/docs'),
  },
  {
    label: 'Pricing',
    to: '/pricing',
  },
  {
    label: 'Blog',
    to: '/blog',
  },
  {
    label: 'Changelog',
    to: '/changelog',
  },
])
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/">
        <AppLogo class="w-auto h-6 shrink-0" />
      </NuxtLink>
      <TemplateMenu />
    </template>

    <UNavigationMenu
      :items="items"
      variant="link"
    />

    <template #right>
      <UColorModeButton />

      <template v-if="user">
        <UDropdownMenu :items="userMenuItems">
          <button
            class="flex items-center gap-2 hover:opacity-75 transition-opacity cursor-pointer"
          >
            <UAvatar
              :alt="user.name || user.email"
              size="sm"
            />
            <span class="hidden lg:block text-sm font-medium text-highlighted">{{
              user.name || user.email
            }}</span>
          </button>
        </UDropdownMenu>
      </template>

      <template v-else>
        <UButton
          icon="i-lucide-log-in"
          color="neutral"
          variant="ghost"
          to="/login"
          class="lg:hidden"
        />

        <UButton
          label="Sign in"
          color="neutral"
          variant="outline"
          to="/login"
          class="hidden lg:inline-flex"
        />

        <UButton
          label="Sign up"
          color="neutral"
          trailing-icon="i-lucide-arrow-right"
          class="hidden lg:inline-flex"
          to="/signup"
        />
      </template>
    </template>

    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="-mx-2.5"
      />

      <USeparator class="my-6" />

      <template v-if="user">
        <UDropdownMenu :items="userMenuItems">
          <button
            class="flex items-center gap-3 px-1 hover:opacity-75 transition-opacity cursor-pointer"
          >
            <UAvatar
              :alt="user.name || user.email"
              size="sm"
            />
            <span class="text-sm font-medium text-highlighted">{{ user.name || user.email }}</span>
          </button>
        </UDropdownMenu>
      </template>

      <template v-else>
        <UButton
          label="Sign in"
          color="neutral"
          variant="subtle"
          to="/login"
          block
          class="mb-3"
        />
        <UButton
          label="Sign up"
          color="neutral"
          to="/signup"
          block
        />
      </template>
    </template>
  </UHeader>
</template>
