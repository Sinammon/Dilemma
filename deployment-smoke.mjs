// No credentials needed. Never print response bodies or load .env.
const target = process.argv[2];
if (!target) {
  console.error('Usage: npm run test:deployment -- https://YOUR-DEPLOYMENT');
  process.exitCode = 1;
} else {
  try {
    const base = new URL(target);
    if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
      throw new Error('Provide an HTTPS origin without credentials, path or query.');
    }
    async function check(path, options, status, validate) {
      const response = await fetch(new URL(path, base), {
        ...options, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      if (response.status !== status || !response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(`${options?.method ?? 'GET'} ${path}: expected HTTP ${status} JSON; got HTTP ${response.status}. Check deployment functions, project root, domain and protection.`);
      }
      const data = await response.json().catch(() => null);
      if (!validate(data)) throw new Error(`${path}: unexpected JSON response.`);
      console.log(`${options?.method ?? 'GET'} ${path}: passed (HTTP ${status} JSON)`);
    }
    await check('/api/health', {}, 200, data => data?.ok === true);
    await check('/api/import', {}, 405, data => typeof data?.error === 'string');
    await check('/api/import', {
      method: 'POST', headers: { Origin: base.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://invalid.example/itm/123456789012' }),
    }, 400, data => typeof data?.error === 'string');
    console.log('Hosted routing passed. eBay authentication still requires a real listing import.');
  } catch (error) {
    console.error(error instanceof TypeError ? 'Deployment check could not connect. Verify the HTTPS deployment URL.' : error.message);
    process.exitCode = 1;
  }
}
