import { abortableDelay, transientFailure, retryDelayMilliseconds } from '../shared/retry.js';

export function researchCaller({ endpoint, apiKey, fetcher = fetch, signal, timeoutMs }) {
  const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  const deadline = Date.now() + timeoutMs;
  let retried = false;
  const call = async body => {
    while (true) {
      bounded.throwIfAborted();
      try {
        const response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body), signal: bounded, cache: 'no-store' });
        if (!response.ok) {
          let errorData; try { errorData = await response.json(); } catch {}
          const details = errorData?.error?.details || [];
          const daily = details.some(d => d.violations?.some(v => /PerDay/i.test(v.quotaId || '') || v.quotaValue === '0'));
          const delayText = details.find(d => d.retryDelay)?.retryDelay;
          const delay = Number(response.headers.get('retry-after') ?? (typeof delayText === 'string' ? delayText.replace(/s$/, '') : NaN));
          const error = new Error('Research provider unavailable');
          Object.assign(error, { status: response.status, daily, retryAfterSeconds: Number.isFinite(delay) && delay >= 0 ? Math.min(86400, delay) : undefined });
          throw error;
        }
        const data = await response.json();
        bounded.throwIfAborted();
        return data;
      } catch (error) {
        if (bounded.aborted) throw error;
        const delay = retryDelayMilliseconds(error);
        if (!transientFailure(error) || retried || Date.now() + delay >= deadline) throw error;
        retried = true;
        await abortableDelay(delay, bounded);
      }
    }
  };
  return { call, signal: bounded };
}
