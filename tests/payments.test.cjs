const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function load(relative, mocks) {
  const filename = path.join(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, process,
    require: (name) => name in mocks ? mocks[name] : name === '@/lib/admin' ? load('src/lib/admin.ts', {}) : require(name),
  }, { filename });
  return module.exports;
}
function webhook(event, { databaseError = false, badSignature = false, initialStatus = 'pending' } = {}) {
  const state = { status: initialStatus, paid_at: null, writes: 0 };
  const db = { from(table) {
    let changes;
    const filters = {};
    const query = {
      update(value) { changes = value; return query; },
      eq(key, value) { filters[key] = value; return query; },
      in(key, values) { filters[key] = values; return query; },
      then(resolve, reject) {
        if (!databaseError && table === 'orders' && (!filters.status || (Array.isArray(filters.status) ? filters.status.includes(state.status) : filters.status === state.status))) {
          Object.assign(state, changes); state.writes++;
        }
        return Promise.resolve({ error: databaseError ? { message: 'offline' } : null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const handler = load('src/app/api/webhooks/stripe/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
    '@/lib/stripe': { stripe: { webhooks: { constructEvent() { if (badSignature) throw new Error('invalid'); return event; } } } },
    '@/lib/supabase/server': { createServiceClient: () => db },
    '@/lib/plans': { planFromStripePriceId: () => null },
  });
  return { state, run: () => handler.POST({ text: async () => 'signed payload', headers: { get: () => 'signature' } }) };
}
function event(type, payment_status = 'paid', mode = 'payment') {
  return { type, data: { object: { id: 'cs_test', mode, payment_status, metadata: { orderId: 'order_test' } } } };
}

test('unpaid completed checkout does not unlock an order', async () => {
  const flow = webhook(event('checkout.session.completed', 'unpaid'));
  assert.equal((await flow.run()).status, 200);
  assert.equal(flow.state.status, 'pending'); assert.equal(flow.state.writes, 0);
});
for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
  test(`${type} confirms a paid order exactly once on retries`, async () => {
    const flow = webhook(event(type));
    await flow.run(); const paidAt = flow.state.paid_at; await flow.run();
    assert.equal(flow.state.status, 'paid'); assert.ok(paidAt);
    assert.equal(flow.state.paid_at, paidAt); assert.equal(flow.state.writes, 1);
  });
}
for (const type of ['checkout.session.async_payment_failed', 'checkout.session.expired']) {
  test(`${type} cancels a pending order`, async () => {
    const flow = webhook(event(type, 'unpaid')); await flow.run(); assert.equal(flow.state.status, 'canceled');
  });
  for (const status of ['paid', 'fulfilled']) test(`${type} preserves ${status} orders`, async () => {
    const flow = webhook(event(type, 'unpaid'), { initialStatus: status }); await flow.run();
    assert.equal(flow.state.status, status); assert.equal(flow.state.writes, 0);
  });
}
test('subscription checkout cannot mark a gallery order paid', async () => {
  const flow = webhook(event('checkout.session.completed', 'paid', 'subscription'));
  await flow.run(); assert.equal(flow.state.writes, 0);
});
test('invalid webhook signature is rejected before writing', async () => {
  const flow = webhook(event('checkout.session.completed'), { badSignature: true });
  assert.equal((await flow.run()).status, 400); assert.equal(flow.state.writes, 0);
});
test('database failure returns 500 so Stripe can retry confirmation', async () => {
  const flow = webhook(event('checkout.session.async_payment_succeeded'), { databaseError: true });
  assert.equal((await flow.run()).status, 500); assert.equal(flow.state.status, 'pending');
});
test('database failure returns 500 so Stripe can retry cancellation', async () => {
  const flow = webhook(event('checkout.session.async_payment_failed'), { databaseError: true });
  assert.equal((await flow.run()).status, 500);
});

test('late paid confirmation overrides an earlier cancellation event', async () => {
  const flow = webhook(event('checkout.session.async_payment_succeeded'), { initialStatus: 'canceled' });
  await flow.run(); assert.equal(flow.state.status, 'paid');
});

for (const status of ['active', 'trialing', 'past_due', 'unpaid']) {
  test(`existing ${status} subscription opens the portal without a new checkout`, async () => {
    let checkouts = 0; let portals = 0;
    const query = { select() { return query; }, eq() { return query; }, single: async () => ({ data: { id: 'user', stripe_customer_id: 'cus_test', subscription_status: status } }) };
    const handler = load('src/app/api/assinatura/checkout/route.ts', {
      'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
      '@/lib/supabase/server': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user', email: 'buyer@example.test' } } }) }, from: () => query }) },
      '@/lib/plans': { BILLING_OPTIONS: { mensal: { stripePriceId: 'price_test' } } },
      '@/lib/stripe': { stripe: {
        checkout: { sessions: { create: async () => { checkouts++; return { url: 'checkout' }; } } },
        billingPortal: { sessions: { create: async () => { portals++; return { url: 'portal' }; } } },
      } },
    });
    const response = await handler.POST({ json: async () => ({ intervalo: 'mensal' }) });
    assert.equal(response.body.url, 'portal'); assert.equal(checkouts, 0); assert.equal(portals, 1);
  });
}
