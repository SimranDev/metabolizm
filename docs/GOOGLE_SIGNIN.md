# Google Sign-In setup (Android)

The code is already complete on both sides — the native idToken flow
(`apps/mobile/src/lib/auth/index.ts` `signInWithGoogle`), the
`@react-native-google-signin/google-signin` plugin in `app.json`, and the
conditional `google` provider on the server
(`apps/api/src/auth/auth.instance.ts`). What remains is **configuration**:
Google Cloud client IDs and the env vars that carry them.

This guide covers **Android only**. iOS Google sign-in additionally needs an
iOS client id and a `com.googleusercontent.apps.<id>` reverse scheme in
`app.json`, plus an Xcode build — deferred until there's a Mac with Xcode and
an Apple Developer account.

## What's already done in the repo

- App identity renamed to **`com.metabolizm.app`** (`app.json` →
  `ios.bundleIdentifier` and `android.package`). This is why it had to happen
  first: the Android OAuth client below is bound permanently to this package
  name + a signing fingerprint.
- `apps/mobile/.env.example` documents `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` /
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- `apps/api/.env.example` documents `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## The one value you need from this machine

The debug signing fingerprint the Android OAuth client is registered against:

```
Package name : com.metabolizm.app
SHA-1 (debug): 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

This is the standard Expo/React Native template debug keystore
(`apps/mobile/android/app/debug.keystore`), so it stays the same after
`expo prebuild --clean`. Re-read it any time with:

```
JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
keytool -list -v -keystore apps/mobile/android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

> An EAS or Play-App-Signing build is signed by a **different** keystore, so it
> needs its own Android OAuth client registered against that release SHA-1 —
> otherwise the native SDK returns `DEVELOPER_ERROR`. Keep this debug client as
> well; an app can have one Android OAuth client per signing key. The steps live
> in [DEPLOYMENT.md §3](DEPLOYMENT.md#3-google-sign-in-for-the-eas-keystore),
> and can only be run *after* the first EAS build has generated the keystore:
>
> ```
> npx eas-cli@latest credentials -p android    # read the release SHA-1
> ```

## Step 1 — Google Cloud console (your part)

In <https://console.cloud.google.com> → APIs & Services → Credentials, on the
project you want to own this app:

1. **OAuth consent screen** — External, app name "Metabolizm", your support
   email. While unpublished ("Testing"), add your own Google account under
   **Test users** or sign-in returns `access_denied`.
2. **Create OAuth client ID → Web application.** Name it e.g. "Metabolizm API".
   No redirect URIs are needed for the native flow. This is the client the app
   and server both key on — a native idToken carries the **web** client id as
   its audience.
   → copy its **Client ID** and **Client secret**.
3. **Create OAuth client ID → Android.** Package name `com.metabolizm.app`,
   SHA-1 = the debug fingerprint above. Nothing from this client is pasted into
   code or env — registering it (package + SHA-1) is what makes Google trust
   the request coming from this app.

(Skip the iOS client for now — Android only.)

## Step 2 — wire the values (I'll do this once you paste them)

`apps/api/.env` — uncomment and fill:

```
GOOGLE_CLIENT_ID=<web client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<web client secret>
```

`apps/mobile/.env` — add:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
```

The mobile value is the **web** client id, not the Android one — the Android
client has no id that code ever references.

## Step 3 — rebuild (done last, on purpose)

`EXPO_PUBLIC_*` vars are inlined at **bundle time**, and the checked-out
`android/` predates the google-signin plugin, so the native project must be
regenerated *after* the env is set — otherwise it takes two rebuilds:

```
pnpm --filter mobile exec expo prebuild --clean -p android
pnpm android        # expo run:android — full native rebuild
```

This installs a **new** app (`com.metabolizm.app`); the old
`com.anonymous.metabolizmrn` install and its local data are orphaned. Restart
the api after editing its `.env`.

## Step 4 — verify

1. Onboard to the "Save your plan" (or "Welcome back") screen → tap
   **Continue with Google** → the Google account picker appears.
2. Pick a test-user account → lands in the app, signed in.
3. Server check — the account and its linked Google row exist:

   ```
   docker exec metabolizm-rn-postgres-1 psql -U metabolizm -d metabolizm -c \
     "select a.provider_id, u.email from accounts a
      join users u on u.id = a.user_id where a.provider_id = 'google';"
   ```

If the button throws **"Google sign-in is not configured for this build"**,
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` was unset at build time — rebuild after
setting it. A `DEVELOPER_ERROR` from the native SDK means the package name or
SHA-1 on the Android client doesn't match this build.

## Known gotcha for later — account linking

`users.email` is unique and Better Auth's `accountLinking` is unconfigured, so
Google auto-links to an existing account by verified email. Apple's
private-relay address is a *different* email, so if Apple sign-in is added
later it will create a **second** account for the same person unless linking is
configured. Not an issue for Google-only.
