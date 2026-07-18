import { Platform } from 'react-native';

// EXPO_PUBLIC_ vars are inlined at bundle time — the access must stay a
// literal member expression. Empty/unset falls through to the simulator
// default; Android emulators reach the host machine via 10.0.2.2, not
// localhost. Physical devices need EXPO_PUBLIC_API_URL=http://<lan-ip>:3000.
//
// Lives in its own module (not client.ts) so lib/auth/client.ts can import
// it without a cycle: lib/api/client.ts → lib/auth/client.ts → here.
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Platform.select({
    android: 'http://10.0.2.2:3000',
    default: 'http://localhost:3000',
  });
