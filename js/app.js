/* UI layer. Every piece of data reaches the DOM through textContent / createTextNode. */
(function () {
  'use strict';
  var L = window.JRBLogic;
  var STORE_KEY = 'jrb.decisions.v1';
  var LABEL = { pending: 'To review', approved: 'Approved', hold: 'On hold', discarded: 'Discarded' };
  var PRIO = { alta: 'High', media: 'Medium', baja: 'Low' };
  var state = { jobs: [], decisions: load(), status: 'pending', prio: 'todas', soloSalario: false, maxDias: 0, orden: 'score', open: null, confirm: null, ready: false, error: '', source: '' };

  function load() {
    try { return L.parseDecisions(JSON.parse(localStorage.getItem(STORE_KEY))) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, decisions: state.decisions })); return true; } catch (e) { return false; }
  }

  function h(tag, attrs) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(function (c) {
        if (c == null || c === false) return;
        e.append(c.nodeType ? c : document.createTextNode(String(c)));
      });
    }
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function say(t) { $('msg').textContent = t; }
  function cvFile(j) { return j.cv_file ? j.cv_file.split('/').pop() : (j.cv_variant ? 'CV_' + j.cv_variant + '.pdf' : 'to be defined'); }
  function chip(label, pressed, onclick) {
    return h('button', { type: 'button', 'aria-pressed': String(!!pressed), onclick: onclick }, label);
  }
  function statusOf(j) { return L.statusOf(state.decisions, j.id); }

  function renderFilters() {
    var c = L.countByStatus(state.jobs, state.decisions);
    var d = $('f-dec'); d.replaceChildren(h('span', { class: 'lbl' }, 'Status'));
    L.STATUSES.forEach(function (k) {
      d.append(chip(LABEL[k] + ' ' + c[k], state.status === k, function () { state.status = k; state.open = null; state.confirm = null; render(); }));
    });
    var p = $('f-prio'); p.replaceChildren(h('span', { class: 'lbl' }, 'Priority'));
    ['todas'].concat(L.PRIORITIES).forEach(function (k) {
      p.append(chip(k === 'todas' ? 'All' : PRIO[k], state.prio === k, function () { state.prio = k; render(); }));
    });
    var s = $('f-sal'); s.replaceChildren(h('span', { class: 'lbl' }, 'Salary'));
    s.append(chip('Published salary above the floor only', state.soloSalario, function () { state.soloSalario = !state.soloSalario; render(); }));
    var g = $('f-age'); g.replaceChildren(h('span', { class: 'lbl' }, 'Age'));
    [[0, 'Any'], [14, 'Up to 14 days'], [30, 'Up to 30 days'], [60, 'Up to 60 days']].forEach(function (a) {
      g.append(chip(a[1], state.maxDias === a[0], function () { state.maxDias = a[0]; render(); }));
    });
    var o = $('f-sort'); o.replaceChildren(h('span', { class: 'lbl' }, 'Sort'));
    [['score', 'Best score'], ['recent', 'Newest first']].forEach(function (a) {
      o.append(chip(a[1], state.orden === a[0], function () { state.orden = a[0]; render(); }));
    });
    $('counts').replaceChildren(
      h('b', {}, String(state.jobs.length)), ' offers, ',
      h('b', {}, String(c.pending)), ' to review, ',
      h('b', {}, String(c.approved)), ' approved, ',
      h('b', {}, String(c.hold)), ' on hold, ',
      h('b', {}, String(c.discarded)), ' discarded');
    $('source').textContent = state.source;
  }

  function salaryPill(j) {
    if (j.cumple_piso && j.salario_publicado) return h('span', { class: 'pill ok' }, 'Salary ' + j.salario_publicado + (j.moneda ? ' ' + j.moneda : ''));
    if (j.cumple_piso) return h('span', { class: 'pill ok' }, 'Salary above floor');
    return h('span', { class: 'pill warn' }, j.salario_publicado ? 'Salary below floor' : 'Salary not published');
  }
  function agePill(j) {
    var band = L.ageBand(j.antiguedad_dias);
    var cls = band === 'fresh' ? 'ok' : band === 'aging' ? 'warn' : band === 'stale' ? 'bad' : 'warn';
    return h('span', { class: 'pill ' + cls }, 'Posted ' + L.ageText(j.antiguedad_dias));
  }
  function prioPill(j) {
    var cls = j.prioridad === 'alta' ? 'ok' : (j.prioridad === 'media' ? 'warn' : 'bad');
    return h('span', { class: 'pill ' + cls }, 'Priority ' + PRIO[j.prioridad]);
  }

  function decide(j, to) {
    var next = L.applyDecision(state.decisions, j.id, to);
    if (next === state.decisions) return;
    state.decisions = next;
    state.confirm = null;
    if (to !== 'pending') state.open = null;
    say(save() ? '' : 'Could not save to this browser. Export decisions.json to keep them.');
    render();
  }

  function detail(j) {
    var link = j.url;
    var dl = h('dl', {},
      h('dt', {}, 'Strengths'), h('dd', {}, j.fortalezas || '-'),
      h('dt', {}, 'Gaps'), h('dd', {}, j.brechas || '-'),
      h('dt', {}, 'Risks'), h('dd', {}, j.riesgos || '-'),
      h('dt', {}, 'Published'), h('dd', {}, j.fecha_publicacion ? j.fecha_publicacion + ' (' + L.ageText(j.antiguedad_dias) + ')' : 'Date not published by the source' + (j.antiguedad_dias == null ? '. Confirm the offer is still open.' : '')),
      j.expira ? h('dt', {}, 'Closes') : null, j.expira ? h('dd', {}, j.expira) : null,
      h('dt', {}, 'Salary vs floor'), h('dd', {}, j.nota_piso || (j.salario_publicado ? j.salario_publicado + ' ' + j.moneda : 'Not published: ask before investing time.')),
      h('dt', {}, 'Eligible where'), h('dd', {}, j.pais_elegible || '-'),
      h('dt', {}, 'Mode'), h('dd', {}, j.modalidad || '-'),
      h('dt', {}, 'Language'), h('dd', {}, j.idioma),
      h('dt', {}, 'How to apply'), h('dd', {}, (j.metodo_postulacion || '-') + (j.requiere_humano ? '. Needs you for the last step.' : '')),
      h('dt', {}, 'CV to send'), h('dd', {}, cvFile(j)),
      h('dt', {}, 'Verification'), h('dd', {}, j.estado_verificacion || '-'),
      h('dt', {}, 'Notes'), h('dd', {}, j.notas || '-'),
      h('dt', {}, 'Original post'), h('dd', {}, link ? h('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Open on the original site') : 'No valid https link')
    );
    var box = h('div', { class: 'actions' });
    var cur = statusOf(j);
    if (state.confirm === j.id) {
      box.append(h('div', { class: 'confirm' },
        h('div', {}, 'You are about to approve ' + j.puesto + ' at ' + j.empresa + ' with ' + cvFile(j) + '. Approving sends nothing.'),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'go', onclick: function () { decide(j, 'approved'); } }, 'Confirm approval'),
          h('button', { type: 'button', onclick: function () { state.confirm = null; render(); } }, 'Cancel'))));
    } else {
      if (L.canTransition(cur, 'approved')) box.append(h('button', { type: 'button', class: 'go', onclick: function () { state.confirm = j.id; render(); } }, 'Approve to apply'));
      if (L.canTransition(cur, 'hold')) box.append(h('button', { type: 'button', onclick: function () { decide(j, 'hold'); } }, 'Put on hold'));
      if (L.canTransition(cur, 'discarded')) box.append(h('button', { type: 'button', onclick: function () { decide(j, 'discarded'); } }, 'Discard'));
      if (L.canTransition(cur, 'pending')) box.append(h('button', { type: 'button', onclick: function () { decide(j, 'pending'); } }, 'Review again'));
    }
    return h('div', { class: 'detail' }, dl, box);
  }

  function row(j, i) {
    var open = state.open === j.id, st = statusOf(j);
    var head = h('button', { type: 'button', class: 'head', 'aria-expanded': String(open), onclick: function () { state.open = open ? null : j.id; state.confirm = null; render(); } },
      h('span', { class: 'score', 'aria-label': 'Score ' + j.score }, String(j.score)),
      h('span', {},
        h('div', { class: 'title' }, j.puesto),
        h('div', { class: 'meta' }, h('span', {}, j.empresa), h('span', {}, j.modalidad), h('span', {}, j.fuente))),
      h('span', { class: 'state' }, prioPill(j), agePill(j), salaryPill(j), st !== 'pending' ? h('span', { class: 'pill' }, LABEL[st]) : null));
    return h('article', { class: 'job', style: 'animation-delay:' + Math.min(i, 10) * 30 + 'ms' }, head, open ? detail(j) : null);
  }

  function render() {
    renderFilters();
    var list = $('list');
    if (state.error) { list.replaceChildren(h('div', { class: 'empty' }, state.error)); return; }
    if (!state.ready) { list.replaceChildren(h('div', { class: 'empty' }, 'Loading offers...')); return; }
    if (!state.jobs.length) { list.replaceChildren(h('div', { class: 'empty' }, 'No offers loaded. Use "Load jobs file" to pick a JSON file.')); return; }
    var rows = L.filterJobs(state.jobs, state.decisions, { status: state.status, prioridad: state.prio, soloSalario: state.soloSalario, maxDias: state.maxDias, orden: state.orden });
    if (!rows.length) { list.replaceChildren(h('div', { class: 'empty' }, 'No offers match this filter.')); return; }
    list.replaceChildren.apply(list, rows.map(row));
  }

  function setJobs(data, label) {
    var jobs = L.normalizeJobs(data);
    if (!jobs.length) { say('That file has no valid offers (each needs id and puesto).'); return false; }
    state.jobs = jobs; state.source = 'Source: ' + label; state.error = ''; state.ready = true;
    state.open = null; state.confirm = null;
    return true;
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }

  function readFile(file, cb) {
    var fr = new FileReader();
    fr.onload = function () { try { cb(JSON.parse(String(fr.result))); } catch (e) { say('That file is not valid JSON.'); } };
    fr.onerror = function () { say('Could not read that file.'); };
    fr.readAsText(file);
  }

  function wire() {
    $('b-load').addEventListener('click', function () { $('in-jobs').click(); });
    $('b-import').addEventListener('click', function () { $('in-dec').click(); });
    $('in-jobs').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = '';
      if (f) readFile(f, function (d) { if (setJobs(d, 'local file ' + f.name)) { say(''); render(); } });
    });
    $('in-dec').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = '';
      if (f) readFile(f, function (d) {
        var dec = L.parseDecisions(d);
        if (!dec) { say('That file is not a valid decisions.json.'); return; }
        state.decisions = dec; save(); say('Decisions imported.'); render();
      });
    });
    $('b-export').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ version: 1, exported_at: new Date().toISOString(), decisions: state.decisions }, null, 2)], { type: 'application/json' });
      var a = h('a', { href: URL.createObjectURL(blob), download: 'decisions.json' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      say('decisions.json exported.');
    });
    $('b-reset').addEventListener('click', function () {
      if (!Object.keys(state.decisions).length) { say('No decisions to clear.'); return; }
      if (window.confirm('Clear all saved decisions in this browser?')) { state.decisions = {}; save(); say('Decisions cleared.'); render(); }
    });
  }

  wire();
  render();
  /* data/jobs.local.json wins if present (it is gitignored); a missing file is ignored silently. */
  fetchJson('data/jobs.local.json').then(function (d) {
    if (!setJobs(d, 'data/jobs.local.json')) throw new Error('empty');
  }).catch(function () {
    return fetchJson('data/jobs.demo.json').then(function (d) { setJobs(d, 'data/jobs.demo.json (fictional demo data)'); });
  }).catch(function () {
    state.ready = true;
    state.error = 'Could not fetch data files (opening index.html directly blocks this in some browsers). Use "Load jobs file", or run python -m http.server.';
  }).then(render);
})();
