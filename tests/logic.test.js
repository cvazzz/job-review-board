'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../js/logic.js');

const mk = (o) => L.normalizeJob(Object.assign({ id: 'a', puesto: 'Dev', score: 50 }, o));

test('isHttpsUrl accepts only https', () => {
  assert.equal(L.isHttpsUrl('https://example.com/x'), true);
  assert.equal(L.isHttpsUrl('http://example.com'), false);
  assert.equal(L.isHttpsUrl('javascript:alert(1)'), false);
  assert.equal(L.isHttpsUrl('data:text/html,hi'), false);
  assert.equal(L.isHttpsUrl(''), false);
  assert.equal(L.isHttpsUrl(null), false);
});

test('cvVariantFor maps title families', () => {
  assert.equal(L.cvVariantFor('AI Automation Engineer'), 'AI-Automation');
  assert.equal(L.cvVariantFor('Agent Developer'), 'AI-Automation');
  assert.equal(L.cvVariantFor('Senior Data Analyst'), 'Data-BI');
  assert.equal(L.cvVariantFor('BI Developer'), 'Data-BI');
  assert.equal(L.cvVariantFor('Data Engineer'), 'Data-BI');
  assert.equal(L.cvVariantFor('Backend Developer'), 'Software');
});

test('normalizeJob rejects invalid and sanitizes fields', () => {
  assert.equal(L.normalizeJob(null), null);
  assert.equal(L.normalizeJob({ puesto: 'x' }), null);
  const j = mk({ url: 'http://x.com', score: 999, prioridad: 'urgent', idioma: 'fr', cumple_piso: 'Sí', requiere_humano: 'no' });
  assert.equal(j.url, null);
  assert.equal(j.score, 100);
  assert.equal(j.prioridad, 'media');
  assert.equal(j.idioma, 'ES');
  assert.equal(j.cumple_piso, true);
  assert.equal(j.requiere_humano, false);
  assert.equal(j.cv_variant, 'Software');
  assert.equal(mk({ cv_variant: 'Data-BI' }).cv_variant, 'Data-BI');
});

test('normalizeJobs accepts array or {jobs} and dedupes', () => {
  const raw = [{ id: '1', puesto: 'A' }, { id: '1', puesto: 'B' }, { id: '2' }];
  assert.equal(L.normalizeJobs(raw).length, 1);
  assert.equal(L.normalizeJobs({ jobs: raw }).length, 1);
  assert.deepEqual(L.normalizeJobs('nope'), []);
});

test('transitions', () => {
  assert.equal(L.canTransition('pending', 'approved'), true);
  assert.equal(L.canTransition('discarded', 'approved'), false);
  assert.equal(L.canTransition('discarded', 'pending'), true);
  assert.equal(L.canTransition('pending', 'pending'), false);
  let d = L.applyDecision({}, 'a', 'approved', '2026-01-01T00:00:00Z');
  assert.equal(L.statusOf(d, 'a'), 'approved');
  d = L.applyDecision(d, 'a', 'pending');
  assert.equal(L.statusOf(d, 'a'), 'pending');
  assert.deepEqual(L.applyDecision({}, 'a', 'bogus'), {});
});

test('filter and sort', () => {
  const jobs = [
    mk({ id: 'a', score: 60, prioridad: 'alta', cumple_piso: true, salario_publicado: '1500' }),
    mk({ id: 'b', score: 90, prioridad: 'baja' }),
    mk({ id: 'c', score: 90, prioridad: 'alta' }),
  ];
  const dec = { c: { status: 'hold', decided_at: '' } };
  assert.deepEqual(L.filterJobs(jobs, dec, {}).map((j) => j.id), ['b', 'a']);
  assert.deepEqual(L.filterJobs(jobs, dec, { status: 'hold' }).map((j) => j.id), ['c']);
  assert.deepEqual(L.filterJobs(jobs, dec, { prioridad: 'alta' }).map((j) => j.id), ['a']);
  assert.deepEqual(L.filterJobs(jobs, dec, { soloSalario: true }).map((j) => j.id), ['a']);
  assert.deepEqual(L.countByStatus(jobs, dec), { pending: 2, approved: 0, hold: 1, discarded: 0 });
});

test('parseDecisions validates input', () => {
  assert.equal(L.parseDecisions(null), null);
  assert.equal(L.parseDecisions({ decisions: [] }), null);
  const ok = L.parseDecisions({ decisions: { a: { status: 'approved', decided_at: '2026-01-01T00:00:00Z' }, b: { status: 'x' }, c: { status: 'pending' } } });
  assert.deepEqual(Object.keys(ok), ['a']);
});

test('approvedQueue contains only approved', () => {
  const jobs = [mk({ id: 'a' }), mk({ id: 'b' })];
  const q = L.approvedQueue(jobs, { a: { status: 'approved', decided_at: 't' }, b: { status: 'hold', decided_at: 't' } });
  assert.equal(q.length, 1);
  assert.equal(q[0].id, 'a');
});

test('demo data is valid, fictional and https-only', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'jobs.demo.json'), 'utf8'));
  const jobs = L.normalizeJobs(raw);
  assert.equal(jobs.length, raw.length);
  assert.ok(jobs.length >= 10);
  jobs.forEach((j) => assert.ok(j.url && j.url.startsWith('https://example.com/')));
});

test('app code never assigns data through innerHTML', () => {
  for (const f of ['js/app.js', 'index.html']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), f);
  }
});

test('ageDays counts whole days and rejects bad dates', () => {
  const now = new Date(2026, 9, 24);
  assert.equal(L.ageDays('2026-10-24', now), 0);
  assert.equal(L.ageDays('2026-10-14T08:00:00Z', now), 10);
  assert.equal(L.ageDays('2026-08-30', now), 55);
  assert.equal(L.ageDays('', now), null);
  assert.equal(L.ageDays('soon', now), null);
  assert.equal(L.ageDays('2027-01-01', now), 0);
});

test('ageBand and ageText', () => {
  assert.deepEqual([0, 14, 15, 45, 46, null].map(L.ageBand), ['fresh', 'fresh', 'aging', 'aging', 'stale', 'unknown']);
  assert.equal(L.ageText(null), 'date unknown');
  assert.equal(L.ageText(1), '1 day ago');
  assert.equal(L.ageText(12), '12 days ago');
  assert.equal(L.ageText(90), '3 months ago');
});

test('normalizeJob reads the job agent field names', () => {
  const j = L.normalizeJob({ id: 'x', puesto: 'AI Dev', publicada: L.isoDaysAgo(9), salario: 'no publicado', cumple_piso: 'salario_no_publicado',
    pais: 'Peru incluido', metodo: 'Enlace', verificacion: 'ok', cv_file: 'out/cv/2026-10-24/CV_A.pdf', url: 'https://a.b/c' });
  assert.equal(j.antiguedad_dias, 9);
  assert.equal(j.salario_publicado, '');
  assert.equal(j.cumple_piso, false);
  assert.equal(L.normalizeJob({ id: 'y', puesto: 'D', cumple_piso: 'si', salario: '1500/mes' }).cumple_piso, true);
  assert.equal(j.pais_elegible, 'Peru incluido');
  assert.equal(j.estado_verificacion, 'ok');
  assert.equal(L.normalizeJob({ id: 'z', puesto: 'D', dias_atras: 4 }).antiguedad_dias, 4);
});

test('filterJobs by max age and sorting by recency', () => {
  const jobs = [
    { id: 'a', puesto: 'A', dias_atras: 40, score: 90 },
    { id: 'b', puesto: 'B', dias_atras: 3, score: 60 },
    { id: 'c', puesto: 'C', score: 99 },
    { id: 'd', puesto: 'D', dias_atras: 10, score: 70 }
  ].map((r) => L.normalizeJob(r));
  const ids = (o) => L.filterJobs(jobs, {}, o).map((j) => j.id);
  assert.deepEqual(ids({}), ['c', 'a', 'd', 'b']);
  assert.deepEqual(ids({ maxDias: 14 }), ['d', 'b']);
  assert.deepEqual(ids({ orden: 'recent' }), ['b', 'd', 'a', 'c']);
  assert.deepEqual(ids({ maxDias: 60, orden: 'recent' }), ['b', 'd', 'a']);
});
