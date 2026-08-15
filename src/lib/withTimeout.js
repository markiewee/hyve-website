// A promise that can hang is a promise that WILL hang in front of a tenant.
// Born from Julia's eternal "SIGNING IN..." spinner on 15 Aug 2026: the
// supabase-js auth lock stalled signInWithPassword and nothing ever surfaced.
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
