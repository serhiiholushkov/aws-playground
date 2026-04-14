# Authentication Architecture

## Chosen Approach: Pattern A — Frontend-direct (JWT validation only)

Pattern A is used in Word Flow due to its simplicity: the frontend authenticates directly with Cognito, and the backend only validates the resulting JWT token. No Cognito SDK calls are made from the backend, and no IAM permissions are needed for auth.

### How it works

1. Frontend calls Cognito APIs directly (e.g. via AWS Amplify v6)
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

**Cognito: auth flows & tokens**

- [Amazon Cognito user pool authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html) — USER_PASSWORD_AUTH, USER_SRP_AUTH, ADMIN_USER_PASSWORD_AUTH explained
- [Using tokens with Cognito user pools](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html) — access / ID / refresh token lifetimes and use cases
- [Verifying a Cognito JWT](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html) — how to validate the signature, issuer, expiry, and claims step by step

**Cognito: API reference**

- [SignUp](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_SignUp.html) · [ConfirmSignUp](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_ConfirmSignUp.html) · [InitiateAuth](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html) — public (unauthenticated) client-side calls used in Pattern A
- [AdminInitiateAuth](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminInitiateAuth.html) — server-side IAM-authenticated call used in Pattern B

**Frontend SDK**

- [Amplify v6 Auth — use existing Cognito resources](https://docs.amplify.aws/javascript/build-a-backend/auth/use-existing-cognito-resources/) — how to configure `Amplify.configure()` against a CDK-deployed user pool without an Amplify backend
- [Amplify v6 Auth — manage user sessions](https://docs.amplify.aws/javascript/frontend/auth/manage-user-sessions/) — `fetchAuthSession` API (replaces `getSession`), automatic token refresh

**Backend JWT validation**

- [JWT Bearer authentication in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt-authn) — how the backend validates tokens (Pattern A backend side)

**Architecture**

- [AWS Well-Architected: Serverless identity and access management](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/identity-and-access-management.html)

---

## Implementation Guide

### Step 0: Collect CDK stack outputs

After `cdk deploy`, the stack prints three values needed for configuration:

```
Outputs:
CognitoStack.UserPoolId       = us-east-1_XXXXXXXXX
CognitoStack.UserPoolClientId = 26xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CognitoStack.Region           = us-east-1
```

Both patterns require the same three values: `Region`, `UserPoolId`, and `UserPoolClientId`.

---

### Pattern A — Frontend-direct

#### UI (Nuxt)

**1. Install the Amplify library**

```bash
pnpm add aws-amplify
```

**2. Add runtime config**

Expose the Cognito values as public runtime config in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  // ...existing config...
  runtimeConfig: {
    public: {
      cognitoRegion: "", // set via NUXT_PUBLIC_COGNITO_REGION
      cognitoUserPoolId: "", // set via NUXT_PUBLIC_COGNITO_USER_POOL_ID
      cognitoClientId: "", // set via NUXT_PUBLIC_COGNITO_CLIENT_ID
    },
  },
});
```

Set the values in `.env` (never commit to source control):

```
NUXT_PUBLIC_COGNITO_REGION=us-east-1
NUXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NUXT_PUBLIC_COGNITO_CLIENT_ID=26xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**3. Create an Amplify configuration plugin**

`app/plugins/amplify.ts` — configure Amplify once at startup using the runtime config values:

```typescript
import { Amplify } from "aws-amplify";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.public.cognitoUserPoolId,
        userPoolClientId: config.public.cognitoClientId,
      },
    },
  });
});
```

**4. Create an auth composable**

`app/composables/useAuth.ts`:

```typescript
import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  fetchAuthSession,
} from "aws-amplify/auth";

export function useAuth() {
  async function signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    await amplifySignUp({
      username: email,
      password,
      options: { userAttributes: { name, email } },
    });
  }

  async function confirmSignUp(email: string, code: string): Promise<void> {
    await amplifyConfirmSignUp({ username: email, confirmationCode: code });
  }

  async function signIn(email: string, password: string): Promise<void> {
    // Uses USER_SRP_AUTH by default (password never sent in plaintext)
    await amplifySignIn({ username: email, password });
  }

  async function signOut(): Promise<void> {
    await amplifySignOut();
  }

  // Returns a fresh access token, auto-refreshing if expired
  async function getAccessToken(): Promise<string | null> {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  }

  return { signUp, confirmSignUp, signIn, signOut, getAccessToken };
}
```

> **Source:** all functions above (`signUp`, `confirmSignUp`, `signIn`, `signOut`, `fetchAuthSession`) are tree-shakeable named exports from [`aws-amplify/auth`](https://docs.amplify.aws/javascript/frontend/auth/). Amplify v6 stores tokens in `localStorage` automatically after a successful `signIn` call. `fetchAuthSession()` transparently refreshes the access token using the stored refresh token when it expires.

> **SSR note:** `localStorage` is browser-only. Wrap composable usage in `<ClientOnly>` or guard with `import.meta.client` when used in server-rendered pages.

**5. Wire up the login page**

In `app/pages/login.vue`, replace the stub `onSubmit`:

```typescript
const { signIn } = useAuth();
const router = useRouter();

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await signIn(payload.data.email, payload.data.password);
    await router.push("/");
  } catch (err: unknown) {
    toast.add({
      title: "Login failed",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}
```

**6. Wire up the signup page**

In `app/pages/signup.vue`:

```typescript
const { signUp } = useAuth();
const router = useRouter();

// After signUp succeeds, redirect to a confirmation page where the user enters the code
async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await signUp(payload.data.name, payload.data.email, payload.data.password);
    await router.push({
      path: "/confirm",
      query: { email: payload.data.email },
    });
  } catch (err: unknown) {
    toast.add({
      title: "Sign up failed",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}
```

**7. Attach the token to API requests**

Create a Nuxt plugin `app/plugins/api.ts` that injects an authenticated `$fetch` instance:

```typescript
export default defineNuxtPlugin(() => {
  const { getAccessToken } = useAuth();

  const $api = $fetch.create({
    baseURL: useRuntimeConfig().public.apiBaseUrl,
    async onRequest({ options }) {
      const token = await getAccessToken();
      if (token) {
        const headers = new Headers(options.headers as HeadersInit);
        headers.set("Authorization", `Bearer ${token}`);
        options.headers = headers;
      }
    },
  });

  return { provide: { api: $api } };
});
```

Use `useNuxtApp().$api(...)` instead of `$fetch` for any calls to protected backend endpoints.

---

#### Backend (ASP.NET Core)

**1. Add the JWT Bearer package**

```bash
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

**2. Configure authentication in `Program.cs`**

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var region     = builder.Configuration["Cognito:Region"]!;
var userPoolId = builder.Configuration["Cognito:UserPoolId"]!;
var authority  = $"https://cognito-idp.{region}.amazonaws.com/{userPoolId}";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authority;
        options.TokenValidationParameters = new()
        {
            ValidIssuer = authority,
            // Cognito access tokens do not carry an `aud` claim; the client ID
            // appears in the `client_id` claim instead, so audience validation
            // must be disabled when accepting access tokens as Bearer credentials.
            ValidateAudience = false,
        };
    });

builder.Services.AddAuthorization();
```

Then, after `var app = builder.Build()`, add the middleware **in this order**:

```csharp
app.UseAuthentication();
app.UseAuthorization();
```

> **Source:** the `Authority` + `ValidateAudience = false` combination is the standard setup for Cognito — see the official guidance in [Verifying a Cognito JWT](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html). The `aud` claim is absent from Cognito access tokens (present only on ID tokens), which is why audience validation must be disabled when accepting access tokens as Bearer credentials.

**3. Protect endpoints**

```csharp
app.MapGet("/me", (ClaimsPrincipal user) => Results.Ok(new
{
    sub   = user.FindFirst("sub")?.Value,
    email = user.FindFirst("email")?.Value,
}))
.RequireAuthorization();
```

**4. Set configuration values**

Use user-secrets for local development:

```bash
dotnet user-secrets init
dotnet user-secrets set "Cognito:Region"     "us-east-1"
dotnet user-secrets set "Cognito:UserPoolId" "us-east-1_XXXXXXXXX"
```

In production, supply these as environment variables (`COGNITO__REGION`, `COGNITO__USERPOOLID`) or via AWS Systems Manager Parameter Store / Secrets Manager. The `ClientId` is not needed by the backend in Pattern A — JWT signature and issuer validation are sufficient.

---

### Pattern B — Backend-proxied

#### Backend (ASP.NET Core)

**1. Add the required packages**

```bash
dotnet add package AWSSDK.CognitoIdentityProvider
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

**2. Grant IAM permissions**

The backend's execution role (ECS task role, EC2 instance profile, Lambda execution role, etc.) needs:

```json
{
  "Effect": "Allow",
  "Action": [
    "cognito-idp:AdminInitiateAuth",
    "cognito-idp:SignUp",
    "cognito-idp:ConfirmSignUp"
  ],
  "Resource": "arn:aws:cognito-idp:{region}:{account-id}:userpool/{userPoolId}"
}
```

> `SignUp` and `ConfirmSignUp` are unauthenticated public Cognito operations when `generateSecret: false`; they are listed for completeness but do not strictly require IAM. `AdminInitiateAuth` does require the IAM permission.

> **Source:** [AdminInitiateAuth API reference](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminInitiateAuth.html) — documents `AuthFlow` values, required `AuthParameters` keys, and the `AuthenticationResult` response shape (`AccessToken`, `IdToken`, `RefreshToken`, `ExpiresIn`).

**3. Add auth endpoints to `Program.cs`**

```csharp
using System.Security.Claims;
using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var region     = builder.Configuration["Cognito:Region"]!;
var userPoolId = builder.Configuration["Cognito:UserPoolId"]!;
var clientId   = builder.Configuration["Cognito:ClientId"]!;
var authority  = $"https://cognito-idp.{region}.amazonaws.com/{userPoolId}";

// Cognito SDK client — picks up credentials from the IAM role automatically
builder.Services.AddSingleton<IAmazonCognitoIdentityProvider>(
    new AmazonCognitoIdentityProviderClient(Amazon.RegionEndpoint.GetBySystemName(region)));

// JWT validation is still needed for protected endpoints (tokens are issued by
// Cognito regardless of which pattern proxied them to the frontend)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authority;
        options.TokenValidationParameters = new()
        {
            ValidIssuer = authority,
            ValidateAudience = false,
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

// --- Sign-up ---
app.MapPost("/auth/signup", async (SignUpDto req, IAmazonCognitoIdentityProvider cognito) =>
{
    await cognito.SignUpAsync(new SignUpRequest
    {
        ClientId = clientId,
        Username = req.Email,
        Password = req.Password,
        UserAttributes =
        [
            new AttributeType { Name = "email", Value = req.Email },
            new AttributeType { Name = "name",  Value = req.Name  },
        ],
    });
    return Results.Ok();
});

// --- Confirm email ---
app.MapPost("/auth/confirm", async (ConfirmDto req, IAmazonCognitoIdentityProvider cognito) =>
{
    await cognito.ConfirmSignUpAsync(new ConfirmSignUpRequest
    {
        ClientId         = clientId,
        Username         = req.Email,
        ConfirmationCode = req.Code,
    });
    return Results.Ok();
});

// --- Sign-in ---
app.MapPost("/auth/login", async (LoginDto req, IAmazonCognitoIdentityProvider cognito) =>
{
    var response = await cognito.AdminInitiateAuthAsync(new AdminInitiateAuthRequest
    {
        UserPoolId     = userPoolId,
        ClientId       = clientId,
        AuthFlow       = AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
        AuthParameters = new() { ["USERNAME"] = req.Email, ["PASSWORD"] = req.Password },
    });
    var result = response.AuthenticationResult;
    return Results.Ok(new
    {
        accessToken  = result.AccessToken,
        idToken      = result.IdToken,
        refreshToken = result.RefreshToken,
    });
});

// --- Refresh ---
app.MapPost("/auth/refresh", async (RefreshDto req, IAmazonCognitoIdentityProvider cognito) =>
{
    var response = await cognito.AdminInitiateAuthAsync(new AdminInitiateAuthRequest
    {
        UserPoolId     = userPoolId,
        ClientId       = clientId,
        AuthFlow       = AuthFlowType.REFRESH_TOKEN_AUTH,
        AuthParameters = new() { ["REFRESH_TOKEN"] = req.RefreshToken },
    });
    var result = response.AuthenticationResult;
    return Results.Ok(new { accessToken = result.AccessToken, idToken = result.IdToken });
});

// --- Protected example ---
app.MapGet("/me", (ClaimsPrincipal user) => Results.Ok(new
{
    sub   = user.FindFirst("sub")?.Value,
    email = user.FindFirst("email")?.Value,
}))
.RequireAuthorization();

// DTOs
record SignUpDto(string Name, string Email, string Password);
record ConfirmDto(string Email, string Code);
record LoginDto(string Email, string Password);
record RefreshDto(string RefreshToken);
```

**4. Set configuration values**

```bash
dotnet user-secrets init
dotnet user-secrets set "Cognito:Region"     "us-east-1"
dotnet user-secrets set "Cognito:UserPoolId" "us-east-1_XXXXXXXXX"
dotnet user-secrets set "Cognito:ClientId"   "26xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

For local development without an IAM role, configure AWS credentials via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) or `~/.aws/credentials`.

---

#### UI (Nuxt)

The frontend no longer calls Cognito directly — all auth calls go to the backend API.

**1. Add runtime config**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // ...existing config...
  runtimeConfig: {
    public: {
      apiBaseUrl: "", // set via NUXT_PUBLIC_API_BASE_URL
    },
  },
});
```

**2. Create an auth composable**

`app/composables/useAuth.ts`:

```typescript
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export function useAuth() {
  const config = useRuntimeConfig();
  const api = $fetch.create({ baseURL: config.public.apiBaseUrl });

  async function signUp(name: string, email: string, password: string) {
    await api("/auth/signup", {
      method: "POST",
      body: { name, email, password },
    });
  }

  async function confirmSignUp(email: string, code: string) {
    await api("/auth/confirm", { method: "POST", body: { email, code } });
  }

  async function signIn(email: string, password: string) {
    const tokens = await api<{ accessToken: string; refreshToken: string }>(
      "/auth/login",
      {
        method: "POST",
        body: { email, password },
      },
    );
    if (import.meta.client) {
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  }

  function signOut() {
    if (import.meta.client) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  function getAccessToken(): string | null {
    return import.meta.client ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  }

  return { signUp, confirmSignUp, signIn, signOut, getAccessToken };
}
```

**3. Wire up the login page**

In `app/pages/login.vue`, replace the stub `onSubmit`:

```typescript
const { signIn } = useAuth();
const router = useRouter();

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await signIn(payload.data.email, payload.data.password);
    await router.push("/");
  } catch (err: unknown) {
    toast.add({
      title: "Login failed",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
    });
  }
}
```

**4. Attach the token to API requests**

The `$fetch` interceptor plugin is identical to Pattern A — create `app/plugins/api.ts`:

```typescript
export default defineNuxtPlugin(() => {
  const { getAccessToken } = useAuth();

  const $api = $fetch.create({
    baseURL: useRuntimeConfig().public.apiBaseUrl,
    onRequest({ options }) {
      const token = getAccessToken();
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    },
  });

  return { provide: { api: $api } };
});
```

Use `useNuxtApp().$api(...)` for all authenticated requests to the backend.
