export const abortableDelay = (milliseconds, signal) => new Promise((resolve, reject) => {
  signal.throwIfAborted();
  const finish = () => { signal.removeEventListener('abort', aborted); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  const aborted = () => { clearTimeout(timer); reject(signal.reason); };
  signal.addEventListener('abort', aborted, { once: true });
});

export const transientFailure = error => error instanceof TypeError || [500, 502, 503, 504].includes(error.status) || error.status === 429 && !error.daily && error.retryAfterSeconds != null && error.retryAfterSeconds <= 2;
export const retryDelayMilliseconds = error => Math.max(1000, (error.retryAfterSeconds || 0) * 1000);
