import { fetchAuthSession } from 'aws-amplify/auth'

interface UserAttributes {
  sub?: string
  email?: string
  name?: string
  [key: string]: string | undefined
}

export function useCurrentUser() {
  const user = useState<UserAttributes | null>('currentUser', () => null)

  async function refresh(): Promise<void> {
    try {
      const session = await fetchAuthSession()
      if (!session.tokens?.accessToken) {
        user.value = null
        return
      }
      const { $api } = useNuxtApp()
      user.value = await ($api as (url: string) => Promise<UserAttributes>)('/me')
    } catch {
      user.value = null
    }
  }

  function clear(): void {
    user.value = null
  }

  return { user, refresh, clear }
}
