const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(relative, mocks = {}, globals = {}) {
  const filename = path.join(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, process: { env: { GOOGLE_CLIENT_SECRET: 'local-test-secret', GOOGLE_CLIENT_ID: 'fixture', GOOGLE_REFRESH_TOKEN: 'fixture' } }, Buffer, URL, URLSearchParams, AbortSignal, Date, ...globals,
    require: (name) => name in mocks ? mocks[name] : require(name),
  }, { filename });
  return module.exports;
}
const binding = { uploadUrl: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture', userId: 'user', galleryId: 'gallery', sizeBytes: 100 };
const sessions = load('src/lib/upload-session.ts');
test('recovery token is bound to the user and gallery', () => {
  const token = sessions.signUploadSession(binding);
  assert.equal(sessions.readUploadSession(token, 'user', 'gallery').sizeBytes, 100);
  assert.equal(sessions.readUploadSession(token, 'other', 'gallery'), null);
  assert.equal(sessions.readUploadSession(token, 'user', 'other'), null);
});
test('recovery token rejects tampering and arbitrary server URLs', () => {
  const token = sessions.signUploadSession(binding);
  assert.equal(sessions.readUploadSession(`A${token.slice(1)}`, 'user', 'gallery'), null);
  const evil = sessions.signUploadSession({ ...binding, uploadUrl: 'https://example.org/private' });
  assert.equal(sessions.readUploadSession(evil, 'user', 'gallery'), null);
});
test('recovery token expires', () => {
  const token = sessions.signUploadSession(binding);
  class FutureDate extends Date { static now() { return Date.now() + 2 * 60 * 60 * 1000; } }
  const future = load('src/lib/upload-session.ts', {}, { Date: FutureDate });
  assert.equal(future.readUploadSession(token, 'user', 'gallery'), null);
});

function client({ xhrFails = false, xhrBody = '{"id":"drive-file"}', status = { complete: true, fileId: 'recovered', receivedBytes: 100 } } = {}) {
  const requests = [];
  class XHR {
    constructor() { this.upload = {}; this.status = 200; this.responseText = xhrBody; }
    open(method, url) { requests.push({ method, url, headers: {} }); }
    setRequestHeader(k, v) { requests.at(-1).headers[k] = v; }
    send(blob) { this.blob = blob; if (xhrFails) this.onerror(); else { this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 }); this.onload(); } }
  }
  let checks = 0;
  const helpers = load('src/lib/upload-client.ts', {}, { XMLHttpRequest: XHR, fetch: async () => { checks++; return { ok: true, json: async () => status }; } });
  return { helpers, requests, checks: () => checks };
}
const file = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
test('original upload reports actual byte progress', async () => {
  const flow = client(); const values = [];
  const id = await flow.helpers.uploadOriginal('gallery', { uploadUrl: 'drive', token: 'signed' }, file, (p) => values.push(p));
  assert.equal(id, 'drive-file'); assert.ok(values.includes(0.5)); assert.equal(values.at(-1), 1); assert.equal(flow.checks(), 0);
});
test('a lost Drive response is recovered without uploading a duplicate', async () => {
  const flow = client({ xhrFails: true });
  assert.equal(await flow.helpers.uploadOriginal('gallery', { uploadUrl: 'drive', token: 'signed' }, file, () => {}), 'recovered');
  assert.equal(flow.requests.length, 1); assert.equal(flow.checks(), 1);
});
test('retry reuses a completed Drive session without sending bytes again', async () => {
  const flow = client();
  assert.equal(await flow.helpers.uploadOriginal('gallery', { uploadUrl: 'drive', token: 'signed' }, file, () => {}, true), 'recovered');
  assert.equal(flow.requests.length, 0);
});
test('incomplete Drive retry resumes at the confirmed byte offset', async () => {
  const flow = client({ status: { complete: false, receivedBytes: 40 } });
  await flow.helpers.uploadOriginal('gallery', { uploadUrl: 'drive', token: 'signed' }, file, () => {}, true);
  assert.equal(flow.requests[0].headers['Content-Range'], 'bytes 40-99/100');
});
test('unconfirmed Drive upload remains an error rather than false success', async () => {
  const flow = client({ xhrFails: true, status: { complete: false, receivedBytes: 40 } });
  await assert.rejects(flow.helpers.uploadOriginal('gallery', { uploadUrl: 'drive', token: 'signed' }, file, () => {}), /não terminou/);
});
test('expired Drive session asks for a new selection without sending', async () => {
  const flow = client({ status: { complete: false, receivedBytes: 0, expired: true } });
  await assert.rejects(flow.helpers.uploadOriginal('gallery', { uploadUrl: 'drive', token: 'signed' }, file, () => {}, true), /expirou/);
  assert.equal(flow.requests.length, 0);
});
for (const [status, range, expected] of [[200, null, 'complete'], [308, 'bytes=0-42', 43], [308, null, 0], [404, null, 'expired']]) {
  test(`Drive server query handles HTTP ${status} / ${range}`, async () => {
    const requests = [];
    const drive = load('src/lib/drive.ts', {}, { fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'fixture', expires_in: 3600 }) };
      return { ok: status === 200, status, headers: { get: () => range }, json: async () => ({ id: 'file-id' }) };
    } });
    const result = await drive.queryDriveUpload({refreshToken:"fixture"}, binding.uploadUrl, 100);
    if (expected === 'complete') assert.equal(result.fileId, 'file-id');
    else if (expected === 'expired') assert.equal(result.expired, true);
    else assert.equal(result.receivedBytes, expected);
    assert.equal(requests[1].options.headers['Content-Range'], 'bytes */100');
    assert.equal(requests[1].options.redirect, 'manual');
  });
}

function previewFixture({ user = { id: 'user' }, gallery = { id: 'gallery' }, storeFails = false, saveFails = false } = {}) {
  let writes = 0; let avatarUpdates = 0;
  const db = { auth: { getUser: async () => ({ data: { user } }) }, from(table) {
    const q = { select() { return q; }, eq() { return q; }, update() { avatarUpdates++; return q; }, single: async () => ({ data: table === 'galleries' ? gallery : { id: 'user' }, error: saveFails ? { message: 'offline' } : null }) }; return q;
  } };
  const handler = load('src/app/api/upload/preview/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
    '@/lib/supabase/server': { createClient: () => db },
    '@/lib/r2': { mediaKey: () => 'gallery-key', avatarKey: () => 'avatar-key', publicPreviewUrl: () => 'https://example.test/avatar.jpg', storePhotoPreview: async () => { if (storeFails) throw new Error('offline'); writes++; } },
  });
  return { handler, writes: () => writes, avatarUpdates: () => avatarUpdates };
}
function previewRequest({ avatar = false, contentType = 'image/jpeg', bytes = [255, 216, 255, 1], length } = {}) {
  const url = `http://localhost/api/upload/preview?${avatar ? 'kind=avatar' : 'galleryId=11111111-1111-4111-8111-111111111111'}`;
  const request = new Request(url, { method: 'POST', headers: { 'Content-Type': contentType, ...(length ? { 'Content-Length': String(length) } : {}) }, body: new Uint8Array(bytes) });
  request.nextUrl = new URL(url); return request;
}
test('photo preview is saved through the authenticated same-origin route', async () => {
  const flow = previewFixture(); const res = await flow.handler.POST(previewRequest());
  assert.equal(res.status, 200); assert.equal(res.body.key, 'gallery-key'); assert.equal(flow.writes(), 1);
});
test('avatar upload persists the profile before confirming success', async () => {
  const flow = previewFixture(); const res = await flow.handler.POST(previewRequest({ avatar: true }));
  assert.equal(res.status, 200); assert.equal(res.body.publicUrl, 'https://example.test/avatar.jpg'); assert.equal(flow.avatarUpdates(), 1);
});
for (const [name, options, request, status] of [
  ['logged-out user', { user: null }, {}, 401], ['another gallery', { gallery: null }, {}, 404],
  ['non-image payload', {}, { bytes: [1, 2, 3, 4] }, 400], ['wrong MIME', {}, { contentType: 'text/plain' }, 400],
  ['oversized content length', {}, { length: 4 * 1024 * 1024 }, 413], ['storage failure', { storeFails: true }, {}, 502],
  ['avatar persistence failure', { saveFails: true }, { avatar: true }, 500],
]) test(`preview rejects ${name}`, async () => {
  const flow = previewFixture(options); const res = await flow.handler.POST(previewRequest(request)); assert.equal(res.status, status);
  if ([400, 401, 404, 413].includes(status)) assert.equal(flow.writes(), 0);
});
test('streamed body is bounded even without Content-Length', async () => {
  const flow = previewFixture();
  const req = previewRequest();
  Object.defineProperty(req, 'body', { value: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(3 * 1024 * 1024 + 1)); controller.close(); } }) });
  assert.equal((await flow.handler.POST(req)).status, 413); assert.equal(flow.writes(), 0);
});
