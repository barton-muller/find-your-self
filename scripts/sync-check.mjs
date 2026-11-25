// Runs src/sync.ts (the trip sync) against a fake server of every git host from pages-storage, in Node: no browser, no network.
//   npm run test:sync
// It builds sync.ts with rolldown (it is a dependency of Vite), points fetch at the fake host, and runs the same trip scenarios on
// GitHub, GitLab and Forgejo. A change to sync.ts, or to a host adapter in pages-storage, that breaks one host shows up here.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import { fakes } from 'pages-storage/testing';

const dir = mkdtempSync(join(tmpdir(), 'sync-check-'));
const bundle = await rolldown({ input: 'src/sync.ts', platform: 'node' });
await bundle.write({ file: join(dir, 'sync.mjs'), format: 'esm' });
const { syncPlan, fetchRemote, listRemoteTrips, detectDir, configured } = await import(pathToFileURL(join(dir, 'sync.mjs')));

const plan = (stops = {}, at = 1) => ({ v: 1, todos: {}, start: '2026-01-01', end: '2026-01-10', startId: 'a', metaUpdatedAt: at, stops, legs: {} });
const stop = (name, updatedAt) => ({ id: name, name, updatedAt, nights: 1 });
const json = (p) => JSON.stringify(p, null, 1);

const hosts = {
  github: { make: () => fakes.github(), server: undefined },
  gitlab: { make: () => fakes.gitlab(), server: 'https://git.example.org' },
  forgejo: { make: () => fakes.forgejo(), server: 'https://git.example.org' },
};

let failed = 0;
let count = 0;
const test = async (name, fn) => {
  count++;
  try { await fn(); } catch (e) { failed++; console.error('FAIL', name, '\n ', e?.message ?? e); }
};

for (const [id, { make, server: origin }] of Object.entries(hosts)) {
  const setup = (branch = 'u/anna') => {
    const server = make();
    globalThis.fetch = server.fetch;
    const cfg = { token: `tok-${id}-${Math.random()}`, repo: 'me/data', server: origin, path: 'trips/t1/plan.json', branch, dir: '' };
    return { server, cfg };
  };

  await test(`${id}: the first sync makes a personal branch from "template" and writes the plan there`, async () => {
    const { server, cfg } = setup();
    server.seed({ 'README.md': 'main' });
    server.seed({ 'README.md': 'main', 'trips/example/plan.json': json(plan()) }, 'template');
    const mine = plan({ a: stop('Hanoi', 5) }, 5);
    assert.deepEqual(await syncPlan(cfg, mine), mine);
    assert.deepEqual(Object.keys(server.files('u/anna')).sort(), ['README.md', 'trips/example/plan.json', 'trips/t1/plan.json']);
    assert.deepEqual(server.files('main'), { 'README.md': 'main' });
    assert.equal(JSON.parse(server.files('u/anna')['trips/t1/plan.json']).stops.a.name, 'Hanoi');
  });

  await test(`${id}: a second device merges per record, newest wins, and both end the same`, async () => {
    const { server, cfg } = setup('main');
    server.seed({ 'README.md': 'x' });
    await syncPlan(cfg, plan({ a: stop('Hanoi', 5), b: stop('Hue', 5) }));
    const second = await syncPlan(cfg, plan({ a: stop('Hanoi old', 1), c: stop('Saigon', 9) }));
    assert.deepEqual(Object.keys(second.stops).sort(), ['a', 'b', 'c']);
    assert.equal(second.stops.a.name, 'Hanoi'); // the remote record was newer
    assert.deepEqual(JSON.parse(server.files('main')['trips/t1/plan.json']), second);
    assert.equal((await fetchRemote(cfg)).plan.stops.c.name, 'Saigon');
  });

  await test(`${id}: nothing to write means no commit`, async () => {
    const { server, cfg } = setup('main');
    server.seed({ 'README.md': 'x' });
    await syncPlan(cfg, plan({ a: stop('Hanoi', 5) }));
    const before = server.commitCount();
    await syncPlan(cfg, plan({ a: stop('Hanoi', 5) }));
    assert.equal(server.commitCount(), before);
  });

  await test(`${id}: someone else committing in the middle of a sync is merged, not lost`, async () => {
    const { server, cfg } = setup('main');
    server.seed({ 'README.md': 'x', [cfg.path]: json(plan({ a: stop('Hanoi', 1) })) });
    server.beforeWrite = () => server.commitElsewhere({ [cfg.path]: json(plan({ a: stop('Hanoi', 1), z: stop('Elsewhere', 7) })) });
    const result = await syncPlan(cfg, plan({ a: stop('Hanoi', 1), m: stop('Mine', 8) }));
    assert.deepEqual(Object.keys(result.stops).sort(), ['a', 'm', 'z']);
    assert.deepEqual(Object.keys(JSON.parse(server.files('main')[cfg.path]).stops).sort(), ['a', 'm', 'z']);
  });

  await test(`${id}: fetchRemote is null for a trip that is not there yet`, async () => {
    const { server, cfg } = setup('main');
    server.seed({ 'README.md': 'x' });
    assert.equal(await fetchRemote(cfg), null);
  });

  await test(`${id}: trips in the repo are listed, in the root or in the app's folder`, async () => {
    const { server, cfg } = setup('main');
    server.seed({ 'plan.json': json(plan()), 'trips/asia/plan.json': json(plan()), 'trips/europe/plan.json': json(plan()), 'trips/europe/notes.md': 'n', 'other/plan.json': '{}' });
    assert.deepEqual(await listRemoteTrips(cfg), [{ name: 'Main trip', path: 'plan.json' }, { name: 'asia', path: 'trips/asia/plan.json' }, { name: 'europe', path: 'trips/europe/plan.json' }]);
    assert.equal(await detectDir(cfg), '');
    const folder = setup('main');
    folder.server.seed({ 'find-your-self/trips/x/plan.json': json(plan()), 'README.md': 'x' });
    assert.deepEqual(await listRemoteTrips({ ...folder.cfg, dir: 'find-your-self/' }), [{ name: 'x', path: 'trips/x/plan.json' }]);
    assert.equal(await detectDir(folder.cfg), 'find-your-self/');
  });

  await test(`${id}: a wrong token and a missing repo say so in words`, async () => {
    const { server, cfg } = setup('main');
    server.seed({ 'README.md': 'x' });
    server.requireToken = 'right';
    await assert.rejects(() => syncPlan({ ...cfg, token: `wrong-${id}` }, plan()), /rejected the token/);
    server.requireToken = null;
    server.repoMissing = true;
    await assert.rejects(() => syncPlan({ ...cfg, token: `another-${id}` }, plan()), /could not find|not found/i);
  });

  await test(`${id}: no network says that it could not reach the host`, async () => {
    const { server, cfg } = setup('main');
    server.down = true;
    await assert.rejects(() => syncPlan(cfg, plan()), /Could not reach/);
  });
}

await test('configured: GitLab subgroups are fine, a plain word is not', () => {
  assert.ok(configured({ token: 't', repo: 'group/sub/project', path: 'plan.json', branch: 'main' }));
  assert.ok(!configured({ token: 't', repo: 'project', path: 'plan.json', branch: 'main' }));
  assert.ok(!configured({ token: 't', repo: 'a/b', path: 'plan.json', branch: 'main', server: 'http://insecure' }));
});

rmSync(dir, { recursive: true, force: true });
console.log(failed ? `${failed} of ${count} failed` : `${count} checks passed`);
process.exit(failed ? 1 : 0);
