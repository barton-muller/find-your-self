// Run: node worker/test.mjs   (needs Node 18+; GitHub is mocked)
import worker from './index.js';

const env = { GITHUB_CLIENT_ID: 'Iv1.public', GITHUB_CLIENT_SECRET: 'shh', ALLOWED_ORIGINS: 'https://me.github.io, http://localhost:5173' };
const seen = [];
globalThis.fetch = async (url, init) => {
  seen.push({ url, body: Object.fromEntries(new URLSearchParams(init.body)) });
  const b = seen[seen.length - 1].body;
  if (b.code === 'bad') return new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 200 });
  return new Response(JSON.stringify({ access_token: 'ghu_abc', expires_in: 28800, refresh_token: 'ghr_def', refresh_token_expires_in: 15811200, scope: '', token_type: 'bearer', extra: 'dropped' }), { status: 200 });
};
const call = (path, body, origin = 'https://me.github.io', method = 'POST') =>
  worker.fetch(new Request(`https://relay.example${path}`, { method, headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);

let fails = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) fails++; };

let r = await call('/token', { code: 'c1', redirect_uri: 'https://me.github.io/app/', code_verifier: 'v'.repeat(50) });
let j = await r.json();
check('token: 200 and fields', r.status === 200 && j.access_token === 'ghu_abc' && j.refresh_token === 'ghr_def' && j.extra === undefined);
check('token: secret added, verifier passed', seen.at(-1).body.client_secret === 'shh' && seen.at(-1).body.code_verifier === 'v'.repeat(50) && seen.at(-1).body.client_id === 'Iv1.public');
check('token: CORS header for the caller', r.headers.get('Access-Control-Allow-Origin') === 'https://me.github.io');
check('token: no caching', r.headers.get('Cache-Control') === 'no-store');

r = await call('/refresh', { refresh_token: 'ghr_def' });
j = await r.json();
check('refresh: 200', r.status === 200 && j.access_token === 'ghu_abc');
check('refresh: grant type', seen.at(-1).body.grant_type === 'refresh_token' && seen.at(-1).body.refresh_token === 'ghr_def');

r = await call('/token', { code: 'c', redirect_uri: 'https://me.github.io/app/' }, 'https://evil.example');
check('other origin refused', r.status === 403 && r.headers.get('Access-Control-Allow-Origin') === null);
r = await call('/token', { code: 'c', redirect_uri: 'https://me.github.io/app/' }, '');
check('no origin refused', r.status === 403);
r = await call('/token', { code: 'c', redirect_uri: 'https://evil.example/' });
check('redirect on another site refused', r.status === 400);
r = await call('/token', { code: 'bad', redirect_uri: 'https://me.github.io/app/' });
check('GitHub error passed on', r.status === 400 && (await r.json()).error === 'bad_verification_code');
r = await call('/token', { redirect_uri: 'https://me.github.io/app/' });
check('missing code', r.status === 400);
r = await call('/nope', { x: 1 });
check('unknown path', r.status === 404);
r = await call('/token', null, 'https://me.github.io', 'GET');
check('GET refused', r.status === 405);
r = await call('/token', null, 'https://me.github.io', 'OPTIONS');
check('preflight allowed', r.status === 204 && r.headers.get('Access-Control-Allow-Headers') === 'Content-Type');
r = await call('/token', null, 'https://evil.example', 'OPTIONS');
check('preflight refused', r.status === 403);
const n = seen.length;
await worker.fetch(new Request('https://relay.example/token', { method: 'POST', headers: { Origin: 'https://me.github.io' }, body: 'not json' }), env);
check('bad JSON does not reach GitHub', seen.length === n);

console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
