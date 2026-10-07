import request from 'supertest';
import { closeTestApp, createTestApp, registerBusiness, sessionAsMember, sessionFrom, SUPERADMIN, type TestContext } from './helpers.js';

let ctx: TestContext;
const http = () => request(ctx.app.getHttpServer());
const bearer = { type: 'bearer' as const };

beforeAll(async () => {
  ctx = await createTestApp();
}, 180_000);

afterAll(async () => {
  await closeTestApp(ctx);
});

const report = (token: string, body: Record<string, unknown> = {}) =>
  http()
    .post('/api/billing/payments')
    .auth(token, bearer)
    .send({ planCode: 'pro', billingCycle: 'monthly', amount: 33000, currency: 'PEN', method: 'yape', reference: 'OP-123456', paidOn: '2026-10-06', ...body });

async function platformToken(): Promise<string> {
  const res = await http().post('/api/auth/login').send(SUPERADMIN).expect(200);
  return sessionFrom(res).token;
}

describe('Cobro de la suscripción', () => {
  it('el negocio reporta su pago aunque la prueba haya vencido y la plataforma lo aprueba', async () => {
    const owner = await registerBusiness(ctx.app);
    const orgId = owner.body.context.organizationId as string;
    const admin = await platformToken();

    // La prueba vence: el negocio queda en solo lectura, pero puede pagar.
    await http()
      .patch(`/api/platform/organizations/${orgId}/subscription`)
      .auth(admin, bearer)
      .send({ trialEndsAt: new Date(Date.now() - 60_000).toISOString() })
      .expect(200);
    await http().post('/api/clients').auth(owner.token, bearer).send({ firstName: 'X' }).expect(402);

    const overview = (await http().get('/api/billing').auth(owner.token, bearer).expect(200)).body;
    expect(overview.subscription).toMatchObject({ planCode: 'pro', status: 'expired' });
    expect(overview.plans.map((p: { code: string }) => p.code)).toEqual(expect.arrayContaining(['starter', 'pro', 'business']));

    const pending = (await report(owner.token).expect(201)).body;
    expect(pending).toMatchObject({ status: 'pending', amount: 33000, method: 'yape' });
    expect((await report(owner.token).expect(409)).body.code).toBe('PAYMENT_PENDING');

    // Solo el Dueño gestiona la suscripción.
    const adminMember = await sessionAsMember(ctx.app, orgId, 'admin');
    await http().get('/api/billing').auth(adminMember.token, bearer).expect(403);

    const queue = (await http().get('/api/platform/billing/payments').auth(admin, bearer).expect(200)).body;
    expect(queue.find((p: { id: string }) => p.id === pending.id)).toMatchObject({ organization: { name: expect.any(String) } });
    await http().get('/api/platform/billing/payments').auth(owner.token, bearer).expect(403);

    const approved = (await http().post(`/api/platform/billing/payments/${pending.id}/approve`).auth(admin, bearer).expect(201)).body;
    expect(approved.status).toBe('approved');
    const days = (Date.parse(approved.periodEnd) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);

    const me = (await http().get('/api/auth/me').auth(owner.token, bearer).expect(200)).body;
    expect(me.subscription).toMatchObject({ status: 'active', readOnly: false, planCode: 'pro' });
    await http().post('/api/clients').auth(owner.token, bearer).send({ firstName: 'Ya puedo' }).expect(201);

    // Un segundo pago anual se suma al periodo vigente; uno rechazado deja el motivo.
    const yearly = (await report(owner.token, { billingCycle: 'yearly', amount: 330000, reference: 'OP-999' }).expect(201)).body;
    const extended = (await http().post(`/api/platform/billing/payments/${yearly.id}/approve`).auth(admin, bearer).expect(201)).body;
    expect(Date.parse(extended.periodEnd) - Date.parse(approved.periodEnd)).toBeGreaterThan(360 * 86_400_000);

    const bad = (await report(owner.token, { reference: 'OP-FALSO' }).expect(201)).body;
    await http().post(`/api/platform/billing/payments/${bad.id}/reject`).auth(admin, bearer).send({ reason: 'No encontramos la operación' }).expect(201);
    const history = (await http().get('/api/billing').auth(owner.token, bearer).expect(200)).body.payments;
    expect(history[0]).toMatchObject({ status: 'rejected', rejectReason: 'No encontramos la operación' });
  });
});
