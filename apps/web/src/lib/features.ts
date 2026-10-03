// Feature flags — modules that are built but temporarily switched off. Flip to true to re-enable;
// nav, middleware and dependent widgets all read from here.
export const FEATURES = {
  leaves: false,
  time: false,
  attendance: false,
  tasks: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** Route prefixes owned by each feature; middleware redirects these when the feature is off. */
export const FEATURE_ROUTES: Record<FeatureKey, readonly string[]> = {
  leaves: ['/leaves'],
  time: ['/time'],
  attendance: ['/attendance'],
  tasks: ['/tasks'],
};

export const isFeatureRouteDisabled = (pathname: string): boolean =>
  (Object.keys(FEATURE_ROUTES) as FeatureKey[]).some(
    (key) =>
      !FEATURES[key] &&
      FEATURE_ROUTES[key].some((p) => pathname === p || pathname.startsWith(`${p}/`)),
  );
