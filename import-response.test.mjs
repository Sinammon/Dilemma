import test from 'node:test';
import assert from 'node:assert/strict';
import { readImportResponse } from './src/import-response.js';

test('platform 404 and HTML fallback produce useful errors without exposing bodies', async () => {
  for (const [status, expected] of [[404, /not deployed/], [200, /API is unavailable/], [504, /API is unavailable/]]) {
    await assert.rejects(readImportResponse(new Response('<html>private platform details</html>', {
      status, headers: { 'Content-Type': 'text/html' },
    })), error => expected.test(error.message) && !error.message.includes('private'));
  }
});

test('malformed JSON and wrong response shapes do not become parsing or render errors', async () => {
  await assert.rejects(readImportResponse(new Response('{broken', {
    headers: { 'Content-Type': 'application/json' },
  })), /API is unavailable/);
  for (const body of [null, { ok: true }, { vehicle: {} }]) {
    await assert.rejects(readImportResponse(Response.json(body)), /invalid listing response/);
  }
});

test('backend error messages and valid vehicles are preserved', async () => {
  await assert.rejects(readImportResponse(Response.json({ error: 'This listing is unavailable.' }, { status: 404 })), /This listing is unavailable/);
  const data = { vehicle: { legacyItemId: '123456789012', images: [], itemSpecifics: [] } };
  assert.deepEqual(await readImportResponse(Response.json(data)), data);
});
