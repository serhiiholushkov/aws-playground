# Authentication Architecture

## Chosen Approach: Pattern A — Frontend-direct (JWT validation only)

Pattern A is used in Word Flow due to its simplicity: the frontend authenticates directly with Cognito, and the backend only validates the resulting JWT token. No Cognito SDK calls are made from the backend, and no IAM permissions are needed for auth.

### How it works

1. Frontend calls Cognito APIs directly (e.g. via `amazon-cognito-identity-js` or AWS Amplify)
2. Cognito returns `idToken`, `accessToken`, `refreshToken` to the frontend
3. Frontend includes the token in every API request: `Authorization: Bearer <accessToken>`
4. Backend validates the JWT signature against Cognito's public JWKS endpoint — a plain HTTPS call, no SDK or IAM involved:
   ```
   https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
   ```
5. If the token is valid, the request proceeds; if not, the backend returns `401`

Backend configuration required (user-secrets / environment variables):

- `Cognito:UserPoolId` — to construct the JWKS URL
- `Cognito:ClientId` — to validate the `aud` claim (token was issued for this app)
- `Cognito:Region` — part of the JWKS URL

No `cognito-idp:*` IAM permissions are needed on the backend for this pattern.

---

## Pattern Comparison

### Pattern A — Frontend-direct ✓ (chosen)

**How it works:** Frontend calls Cognito directly, gets tokens, sends them as `Authorization: Bearer` to the backend. Backend validates JWT only.

**Pros:**

- Zero IAM permissions needed on the backend for auth
- Simpler backend — only `Microsoft.AspNetCore.Authentication.JwtBearer`, no Cognito SDK
- Frontend gets tokens without a round-trip through your backend
- Cognito handles rate limiting, MFA challenges, and CAPTCHA directly with the client
- Scales without backend involvement during login

**Cons:**

- `ClientId` is exposed in the frontend bundle (semi-public by design, but worth noting)
- `USER_PASSWORD_AUTH` or `USER_SRP_AUTH` must be enabled on the App Client
- Custom sign-up logic (e.g. creating a DB record on registration) requires Cognito Lambda triggers rather than inline backend code

---

### Pattern B — Backend-proxied auth

**How it works:** Frontend sends credentials to the backend. Backend calls Cognito SDK (`InitiateAuthAsync`, `SignUpAsync`, etc.) and returns tokens to the frontend.

**Pros:**

- `ClientId` never exposed to the browser
- Can use `ADMIN_USER_PASSWORD_AUTH` (more controlled, no client-side auth flow)
- Custom sign-up/sign-in logic is just regular code (e.g. atomically create a DB user on registration)
- Consistent API surface — frontend only talks to your domain
- Easier to mock Cognito in backend tests

**Cons:**

- Backend needs IAM permissions for every Cognito operation
- Every auth request adds a backend round-trip (extra latency, more load)
- More code to maintain — effectively an auth proxy layer
- MFA/challenge flows become stateful and must be managed in the backend

---

## Further Reading

- [Amazon Cognito user pool authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html) — USER_PASSWORD_AUTH, USER_SRP_AUTH, ADMIN_USER_PASSWORD_AUTH explained
- [JWT Bearer authentication in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt-authn) — how the backend validates tokens (Pattern A backend side)
- [AWS Well-Architected: Serverless identity and access management](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/identity-and-access-management.html)
