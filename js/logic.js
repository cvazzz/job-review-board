/* Pure logic for Job Review Board. No DOM, no dependencies. Works in browsers and Node (CommonJS). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JRBLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUSES = ['pending', 'approved', 'hold', 'discarded'];
  var PRIORITIES = ['alta', 'media', 'baja'];
  var TRANSITIONS = {
    pending: ['approved', 'hold', 'discarded'],
    approved: ['pending', 'hold', 'discarded'],
    hold: ['pending', 'approved', 'discarded'],
    discarded: ['pending']
  };

  function isHttpsUrl(u) {
    if (typeof u !== 'string') return false;
    try { return new URL(u.trim()).protocol === 'https:'; } catch (e) { return false; }
  }

  function cvVariantFor(title) {
    var t = String(title || '').toLowerCase();
    if (/\b(ai|agents?|automation|automatizaci\w*|llm|genai)\b/.test(t)) return 'AI-Automation';
    if (/data analyst|data engineer|data scien\w*|\bbi\b|business intelligence|analytics/.test(t)) return 'Data-BI';
    return 'Software';
  }

  function str(v) { return v == null ? '' : String(v).trim(); }
  function truthy(v) {
    if (typeof v === 'boolean') return v;
    return /^(si|sí|yes|true|1|y)$/i.test(str(v));
  }

  /* Returns a safe, uniform job object, or null if it has no id or title. */
  function normalizeJob(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var id = str(raw.id), puesto = str(raw.puesto);
    if (!id || !puesto) return null;
    var score = Number(raw.score);
    if (!isFinite(score)) score = 0;
    score = Math.max(0, Math.min(100, Math.round(score)));
    var prio = str(raw.prioridad).toLowerCase();
    if (PRIORITIES.indexOf(prio) < 0) prio = 'media';
    var idioma = str(raw.idioma).toUpperCase();
    var usd = Number(raw.salario_mensual_usd_est);
    return {
      id: id,
      empresa: str(raw.empresa),
      puesto: puesto,
      url: isHttpsUrl(raw.url) ? str(raw.url) : null,
      fuente: str(raw.fuente),
      pais_elegible: str(raw.pais_elegible),
      modalidad: str(raw.modalidad),
      idioma: idioma === 'EN' ? 'EN' : 'ES',
      fecha_publicacion: str(raw.fecha_publicacion),
      salario_publicado: str(raw.salario_publicado),
      moneda: str(raw.moneda),
      salario_mensual_usd_est: isFinite(usd) && str(raw.salario_mensual_usd_est) !== '' ? usd : null,
      cumple_piso: truthy(raw.cumple_piso),
      score: score,
      prioridad: prio,
      metodo_postulacion: str(raw.metodo_postulacion),
      requiere_humano: truthy(raw.requiere_humano),
      estado_verificacion: str(raw.estado_verificacion),
      fortalezas: str(raw.fortalezas),
      brechas: str(raw.brechas),
      riesgos: str(raw.riesgos),
      notas: str(raw.notas),
      cv_variant: str(raw.cv_variant) || cvVariantFor(puesto)
    };
  }

  /* Accepts an array or {jobs:[...]}; drops invalid entries and duplicate ids. */
  function normalizeJobs(data) {
    var arr = Array.isArray(data) ? data : (data && Array.isArray(data.jobs) ? data.jobs : []);
    var seen = {}, out = [];
    arr.forEach(function (r) {
      var j = normalizeJob(r);
      if (j && !seen[j.id]) { seen[j.id] = true; out.push(j); }
    });
    return out;
  }

  function statusOf(decisions, id) {
    var d = decisions && Object.prototype.hasOwnProperty.call(decisions, id) ? decisions[id] : null;
    return d && STATUSES.indexOf(d.status) >= 0 ? d.status : 'pending';
  }

  function canTransition(from, to) {
    return !!TRANSITIONS[from] && TRANSITIONS[from].indexOf(to) >= 0;
  }

  /* Returns a new decisions object, or the same one if the transition is not allowed. */
  function applyDecision(decisions, id, to, nowIso) {
    var from = statusOf(decisions, id);
    if (!canTransition(from, to)) return decisions;
    var next = Object.assign({}, decisions);
    if (to === 'pending') delete next[id];
    else next[id] = { status: to, decided_at: nowIso || new Date().toISOString() };
    return next;
  }

  function sortJobs(jobs) {
    return jobs.slice().sort(function (a, b) {
      return (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  }

  /* opts: {status, prioridad ('todas' or a priority), soloSalario} */
  function filterJobs(jobs, decisions, opts) {
    opts = opts || {};
    var status = opts.status || 'pending', prio = opts.prioridad || 'todas';
    return sortJobs(jobs.filter(function (j) {
      if (statusOf(decisions, j.id) !== status) return false;
      if (prio !== 'todas' && j.prioridad !== prio) return false;
      if (opts.soloSalario && !(j.cumple_piso && j.salario_publicado)) return false;
      return true;
    }));
  }

  function countByStatus(jobs, decisions) {
    var c = { pending: 0, approved: 0, hold: 0, discarded: 0 };
    jobs.forEach(function (j) { c[statusOf(decisions, j.id)]++; });
    return c;
  }

  /* Validates an imported decisions file; returns a clean {id:{status,decided_at}} map or null. */
  function parseDecisions(data) {
    var src = data && typeof data === 'object' && data.decisions && typeof data.decisions === 'object' ? data.decisions : null;
    if (!src || Array.isArray(src)) return null;
    var out = {};
    Object.keys(src).forEach(function (id) {
      var d = src[id];
      if (d && STATUSES.indexOf(d.status) > 0) {
        var t = typeof d.decided_at === 'string' && !isNaN(Date.parse(d.decided_at)) ? d.decided_at : '';
        out[id] = { status: d.status, decided_at: t };
      }
    });
    return out;
  }

  function approvedQueue(jobs, decisions) {
    return sortJobs(jobs.filter(function (j) { return statusOf(decisions, j.id) === 'approved'; }))
      .map(function (j) {
        return {
          id: j.id, empresa: j.empresa, puesto: j.puesto, url: j.url,
          metodo_postulacion: j.metodo_postulacion, requiere_humano: j.requiere_humano,
          cv_variant: j.cv_variant, score: j.score,
          approved_at: decisions[j.id].decided_at
        };
      });
  }

  return {
    STATUSES: STATUSES, PRIORITIES: PRIORITIES, TRANSITIONS: TRANSITIONS,
    isHttpsUrl: isHttpsUrl, cvVariantFor: cvVariantFor, normalizeJob: normalizeJob,
    normalizeJobs: normalizeJobs, statusOf: statusOf, canTransition: canTransition,
    applyDecision: applyDecision, sortJobs: sortJobs, filterJobs: filterJobs,
    countByStatus: countByStatus, parseDecisions: parseDecisions, approvedQueue: approvedQueue
  };
});
