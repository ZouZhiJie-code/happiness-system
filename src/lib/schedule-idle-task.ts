export type IdleTaskHandle = number;

export function scheduleIdleTask(callback: () => void): IdleTaskHandle {
  if (typeof window === "undefined") {
    return -1;
  }

  if (window.requestIdleCallback) {
    return window.requestIdleCallback(() => {
      callback();
    });
  }

  return window.setTimeout(callback, 1);
}

export function cancelIdleTask(handle: IdleTaskHandle) {
  if (typeof window === "undefined" || handle < 0) {
    return;
  }

  if (window.cancelIdleCallback) {
    window.cancelIdleCallback(handle);
    return;
  }

  window.clearTimeout(handle);
}
