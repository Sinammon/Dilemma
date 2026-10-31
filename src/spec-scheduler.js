export function createSpecScheduler({ quickLimit = 2, researchLimit = 1 } = {}) {
  const jobs = new Map(), queue = [], active = { quick: 0, research: 0 };
  const limits = { quick: quickLimit, research: researchLimit };
  function pump() {
    for (let index = 0; index < queue.length;) {
      const job = queue[index];
      if (active[job.phase] >= limits[job.phase]) { index++; continue; }
      queue.splice(index, 1); job.started = true; active[job.phase]++;
      let onAbort;
      const cancellation = new Promise((resolve, reject) => { onAbort = () => reject(job.controller.signal.reason); job.controller.signal.addEventListener('abort', onAbort, { once: true }); });
      Promise.race([Promise.resolve().then(() => { job.controller.signal.throwIfAborted(); return job.run(job.controller.signal); }), cancellation]).then(job.resolve, job.reject).finally(() => {
        job.controller.signal.removeEventListener('abort', onAbort);
        active[job.phase]--; if (jobs.get(job.key) === job) jobs.delete(job.key); pump();
      });
    }
  }
  return {
    schedule(key, phase, run, signal) {
      signal?.throwIfAborted();
      let job = jobs.get(key);
      if (!job) {
        job = { key, phase, run, controller: new AbortController(), subscribers: new Set(), started: false };
        job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
        jobs.set(key, job); queue.push(job);
      }
      return new Promise((resolve, reject) => {
        const token = {}; job.subscribers.add(token);
        const detach = () => { signal?.removeEventListener('abort', aborted); job.subscribers.delete(token); };
        const aborted = () => {
          detach(); reject(signal.reason);
          if (!job.subscribers.size) {
            job.controller.abort();
            if (jobs.get(key) === job) jobs.delete(key);
            if (!job.started) { const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1); job.reject(job.controller.signal.reason); }
          }
        };
        signal?.addEventListener('abort', aborted, { once: true });
        job.promise.then(value => { detach(); resolve(value); }, error => { detach(); reject(error); });
        pump();
      });
    },
  };
}
export const specScheduler = createSpecScheduler();
