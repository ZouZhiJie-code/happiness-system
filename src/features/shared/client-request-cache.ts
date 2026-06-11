"use client";

const inFlightStore = new Map<string, Promise<unknown>>();

/**
 * Coalesce identical client-side GET requests fired from independent component
 * trees (for example a header toolbar and a page shell mounting at the same
 * time on navigation). Concurrent callers with the same key share one in-flight
 * promise; the entry is cleared as soon as the request settles, so no resolved
 * value is retained between navigations or tests.
 *
 * Pass `force: true` to ignore any in-flight request and start a fresh one.
 */
export async function dedupedRequest<T>(
  key: string,
  loader: () => Promise<T>,
  options?: { force?: boolean }
): Promise<T> {
  if (!options?.force) {
    const existing = inFlightStore.get(key) as Promise<T> | undefined;

    if (existing) {
      return existing;
    }
  }

  const inFlight = loader().finally(() => {
    if (inFlightStore.get(key) === inFlight) {
      inFlightStore.delete(key);
    }
  });

  inFlightStore.set(key, inFlight);

  return inFlight;
}
