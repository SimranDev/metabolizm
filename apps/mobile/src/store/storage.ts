/**
 * On-device key/value storage backed by MMKV, plus a zustand-`persist` adapter.
 *
 * This is the single seam between our stores and the storage engine: MMKV is
 * synchronous (JSI/C++), so persisted stores hydrate during creation with no
 * empty-state flash on launch. Swapping engines later (e.g. to AsyncStorage, or
 * to a backend-synced cache) means editing only this file.
 */

import { createMMKV } from "react-native-mmkv";
import type { StateStorage } from "zustand/middleware";

export const storage = createMMKV({ id: "metabolizm" });

/** `StateStorage` for `createJSONStorage` — wraps MMKV's sync string API. */
export const zustandMmkvStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.remove(name),
};
