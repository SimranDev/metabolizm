/**
 * The authenticated user's own account row. Distinct from `Profile`, which is
 * the device-local onboarding snapshot — this is what the server stores and
 * what every "today" on the backend is computed against.
 */

import type { WeightUnit } from "./health";

export type MeDto = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** IANA timezone name. Drives entry dates, streaks, and group "today". */
  timezone: string;
  weightUnit: WeightUnit;
};

export type MeResponse = { user: MeDto };
