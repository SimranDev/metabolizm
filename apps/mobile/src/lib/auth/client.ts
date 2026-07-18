import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';

import { BASE_URL } from '@/lib/api/base-url';

/**
 * Better Auth client. The session cookie is cached in SecureStore by the
 * expo plugin; other modules attach it to API requests via
 * `authClient.getCookie()` (see lib/api/client.ts). Screens should not use
 * this directly — go through lib/auth (the single auth boundary).
 */
export const authClient = createAuthClient({
  // A path in baseURL doubles as the server's basePath (/v1/auth).
  baseURL: `${BASE_URL}/v1/auth`,
  plugins: [
    expoClient({
      scheme: 'metabolizmrn',
      storagePrefix: 'metabolizm',
      storage: SecureStore,
    }),
  ],
});
