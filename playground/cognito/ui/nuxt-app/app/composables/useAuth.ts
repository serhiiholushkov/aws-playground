import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  fetchAuthSession,
} from 'aws-amplify/auth'

export function useAuth() {
  async function signUp(name: string, email: string, password: string): Promise<void> {
    await amplifySignUp({
      username: email,
      password,
      options: {
        userAttributes: {
          name,
          email,
        },
      },
    })
  }

  async function confirmSignUp(email: string, code: string): Promise<void> {
    await amplifyConfirmSignUp({ username: email, confirmationCode: code })
  }

  async function signIn(email: string, password: string): Promise<void> {
    // Uses USER_SRP_AUTH by default (password never sent in plaintext)
    await amplifySignIn({ username: email, password })
  }

  async function signOut(): Promise<void> {
    await amplifySignOut()
  }

  async function getAccessToken(): Promise<string | null> {
    const session = await fetchAuthSession()
    return session.tokens?.accessToken?.toString() || null
  }

  return {
    signUp,
    confirmSignUp,
    signIn,
    signOut,
    getAccessToken,
  }
}
