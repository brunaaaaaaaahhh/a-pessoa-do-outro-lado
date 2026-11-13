(() => {
const F = window.FIC, M = F.meta, CH = F.chapters;
// Chapters posted from /admin live in extra.js. A draft in this tab's sessionStorage is the admin preview.
const EXTRA = (window.FIC_EXTRA || []).slice();
try {
  const d = JSON.parse(sessionStorage.getItem('apol_draft'));
  if (d && d.n > CH.length) { const i = EXTRA.findIndex(c => c.n === d.n); if (i < 0) EXTRA.push(d); else EXTRA[i] = d; }
} catch (e) {}
if (EXTRA.length) {
  let added = 0;
  EXTRA.sort((a, b) => a.n - b.n).forEach(c => { const r = prepChapter(c.body); added += r.words; CH.push({ n: c.n, title: c.title || '', words: r.words, body: r.body }); });
  const s = M.stats;
  s.Chapters = CH.length + '/?';
  s.Words = (+s.Words.replace(/\D/g, '') + added).toLocaleString('en-US');
  s.Updated = EXTRA.reduce((d, c) => (c.date > d ? c.date : d), s.Updated);
}
const root = document.documentElement;
const app = document.getElementById('app'), bar = document.getElementById('bar'), pct = document.getElementById('pct');
const $ = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const calm = matchMedia('(prefers-reduced-motion: reduce)');

// ------------------------------------------------------------ preferences
const DEF = { theme: 'classico', page: 'auto', font: 'literata', fs: 16, lh: '1.65', measure: '66', align: 'left', para: 'indent' };
let P = Object.assign({}, DEF, store.get('apol_prefs', {}));
if (!document.querySelector(`.fonts [data-v="${P.font}"]`)) P.font = DEF.font;  // fonts removed in an update
let read = store.get('apol_read', []), pos = store.get('apol_pos', {});

const LIGHT = ['papel', 'sepia'];  // page colours the hacker theme does not allow
function applyPrefs() {
  const dark = P.theme === 'hacker';
  if (dark && LIGHT.includes(P.page)) P.page = 'auto';
  document.querySelectorAll('[data-pref="page"] button').forEach(b => { b.disabled = dark && LIGHT.includes(b.dataset.v); });
  for (const k of ['theme', 'page', 'font', 'align', 'para']) root.dataset[k] = P[k];
  root.style.setProperty('--fs', P.fs + 'px');
  root.style.setProperty('--lh', P.lh);
  root.style.setProperty('--measure', P.measure + 'ch');
  document.querySelectorAll('[data-pref]').forEach(g => g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(P[g.dataset.pref]))));
  document.getElementById('fs').value = P.fs;
  document.getElementById('fs-out').textContent = P.fs + ' px';
  store.set('apol_prefs', P);
}
function setPref(k, v) {
  const themeChanged = k === 'theme' && v !== P.theme;
  P[k] = v; applyPrefs();
  if (themeChanged) heroFx();
  if (dock) { dock.remove(); dock = null; onScroll(); }  // restyle the travelling title
}

// ------------------------------------------------------------ helpers
const minutes = w => Math.max(1, Math.round(w / 220));
const fmt = n => n.toLocaleString('pt-BR');
const KINDS = [
  ['messenger-wrapper', '💬', 'MSN'], ['msn-messenger-wrap', '💬', 'MSN web'], ['diana-wrapper', '📮', 'Tumblr'],
  ['tw-body', '🐦', 'Twitter'], ['v3-wrapper', '📱', 'Celular'], ['bb-container', '📱', 'BlackBerry'],
  ['ya-container', '❓', 'Yahoo Respostas'], ['wmp-wrapper', '🎵', 'Media Player'], ['env-scene-wrap', '✉️', 'Carta'],
];
CH.forEach(c => { c.kinds = KINDS.filter(([cls]) => c.body.includes('class="' + cls)); });
function kindTags(c) {
  const w = $('span', 'kinds');
  const seen = new Set();
  c.kinds.forEach(([, ico, name]) => { if (seen.has(ico)) return; seen.add(ico); const k = $('span', 'kind', ico); k.title = name; k.setAttribute('aria-label', name); w.appendChild(k); });
  return w;
}
function htmlBlock(cls, html) { const d = $('div', cls); d.innerHTML = html; return d; }
function notesBox(title, html, open) {
  if (!html) return null;
  const d = $('details', 'notes'); d.open = !!open;
  d.appendChild($('summary', '', title)); d.appendChild(htmlBlock('notes-body', html));
  return d;
}
function go(r) {
  const h = r ? '#' + r : '#';
  if (location.hash === h || (!r && !location.hash)) route(); else location.hash = h;  // same link again: re-run (e.g. scroll back)
}
let resume = false;
function openChapter(n, fromSaved) { resume = !!fromSaved; go('cap/' + n); }
function toast(t) { const e = document.getElementById('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2200); }

// ------------------------------------------------------------ home

function home() {
  app.replaceChildren();
  const h = $('section', 'hero');
  h.appendChild($('div', 'deco'));
  const inner = $('div', 'hero-inner');
  const t = $('h1', '', M.title.replace(/\.$/, ''));
  if (M.title.endsWith('.')) t.appendChild($('span', 'dot', '.'));
  inner.appendChild(t);
  const by = $('p', 'by', 'por ');
  const a = $('a', '', M.author); a.href = M.authorUrl; a.target = '_blank'; a.rel = 'noopener';
  by.appendChild(a); inner.appendChild(by);
  h.appendChild(inner);
  if (window.ART) h.insertAdjacentHTML('beforeend', window.ART);
  app.appendChild(h);
  screenLight(h.querySelector('.art'));

  const c = $('section', 'card intro');
  c.appendChild($('h2', '', 'Sobre a história'));
  c.appendChild(htmlBlock('summary', M.summary));
  const tg = $('div', 'tags');
  [...M.relationships.slice(0, 1), ...M.tags].forEach(t => tg.appendChild($('span', '', t)));
  c.appendChild(tg);
  const total = CH.reduce((s, x) => s + x.words, 0);
  c.appendChild($('p', 'stats', `${CH.length} capítulos · ${fmt(total)} palavras · ~${Math.round(total / 220 / 60)} h de leitura · ${M.rating.join(', ')}`));
  const pg = $('div', 'pg');
  pg.appendChild($('span', '', `${read.length} de ${CH.length} capítulos lidos`));
  const tr = $('div', 'trk'), fl = $('div', 'fill'); fl.style.width = (read.length / CH.length * 100) + '%';
  tr.appendChild(fl); pg.appendChild(tr); c.appendChild(pg);
  const last = store.get('apol_last', null);
  const row = $('div', 'cta-row');
  const b = $('button', 'cta', last ? `Continuar: capítulo ${last}` : 'Começar a ler');
  b.onclick = () => openChapter(last || 1, !!last);
  row.appendChild(b);
  if (read.length || last) {
    const cl = $('button', 'clr', 'limpar histórico de leitura');
    cl.onclick = () => { if (cl.dataset.sure) { read = []; pos = {}; store.set('apol_read', read); store.set('apol_pos', pos); store.set('apol_last', null); home(); toast('Histórico limpo'); } else { cl.dataset.sure = 1; cl.textContent = 'toque de novo para confirmar'; } };
    row.appendChild(cl);
  }
  c.appendChild(row);
  app.appendChild(c);

  const n = notesBox('Nota da autora', F.afterword); if (n) app.appendChild(n);

  const head = $('div', 'sec-row'); head.id = 'capitulos';
  head.appendChild($('h2', 'sec', `Capítulos (${CH.length})`));
  const views = $('div', 'views'); views.setAttribute('role', 'group'); views.setAttribute('aria-label', 'Modo de exibição');
  [['grid', 'Grade', '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'],
   ['list', 'Lista', '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/>']]
    .forEach(([v, t, d]) => { const b = $('button'); b.dataset.v = v; b.title = t; b.setAttribute('aria-label', t); b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`; views.appendChild(b); });
  head.appendChild(views);
  app.appendChild(head);
  const q = $('input', 'search'); q.type = 'search'; q.placeholder = 'Ir para o capítulo… (número)'; q.inputMode = 'numeric'; q.setAttribute('aria-label', 'Ir para o capítulo');
  app.appendChild(q);
  const lg = $('p', 'legend');
  const used = new Map(); CH.forEach(x => x.kinds.forEach(([, i, nm]) => used.set(nm, i)));
  lg.textContent = 'Capítulos com interfaces: ' + [...used].map(([nm, i]) => i + ' ' + nm).join('  ·  ');
  app.appendChild(lg);
  const g = $('div', 'grid');
  const setView = v => { g.classList.toggle('list', v === 'list'); views.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); store.set('apol_view', v); };
  views.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
  CH.forEach(x => {
    const k = $('button', 'chip' + (read.includes(x.n) ? ' read' : '') + (x.n === last ? ' last' : ''));
    k.dataset.n = x.n;
    k.appendChild($('small', '', 'Capítulo'));
    k.appendChild($('b', '', x.n));
    const m = $('span', 'meta', `${minutes(x.words)} min`);
    m.appendChild($('span', 'words', ` · ${fmt(x.words)} palavras`));
    k.appendChild(m); k.appendChild(kindTags(x));
    if (x.title) { k.appendChild($('span', 'ctitle', x.title)); k.title = x.title; }
    const names = [...new Set(x.kinds.map(([, , nm]) => nm))];
    if (names.length) k.appendChild($('span', 'knames', names.join(', ')));
    if (!read.includes(x.n) && pos[x.n] > 0.02) k.appendChild($('span', 'prog', `${Math.round(pos[x.n] * 100)}% lido`));
    k.setAttribute('aria-label', `Capítulo ${x.n}${x.title ? ', ' + x.title : ''}, ${minutes(x.words)} minutos${read.includes(x.n) ? ', lido' : ''}`);
    k.onclick = () => openChapter(x.n, pos[x.n] > 0.02 && pos[x.n] < 0.95);
    g.appendChild(k);
  });
  app.appendChild(g);
  setView(store.get('apol_view', 'grid'));
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = +q.value; if (CH.some(x => x.n === v)) openChapter(v); else toast('Capítulo não encontrado'); } });
  q.addEventListener('input', () => { const v = q.value.trim(); g.querySelectorAll('.chip').forEach(k => k.classList.toggle('dim', !!v && !k.dataset.n.startsWith(v))); });
  heroFx();
}

// ------------------------------------------------------------ about
function about() {
  app.replaceChildren();
  const c = $('section', 'card about');
  c.appendChild($('h1', '', M.title));
  const by = $('p', 'by-line', 'por ');
  const a = $('a', '', M.author); a.href = M.authorUrl; a.target = '_blank'; a.rel = 'noopener'; by.appendChild(a); c.appendChild(by);
  c.appendChild(htmlBlock('summary', M.summary));
  const dl = $('dl', 'facts');
  [['Classificação', M.rating], ['Avisos', M.warnings], ['Fandom', M.fandom], ['Relacionamentos', M.relationships],
   ['Personagens', M.characters], ['Tags', M.tags],
   ['Publicada', [M.stats.Published]], ['Atualizada', [M.stats.Updated]], ['Palavras', [M.stats.Words]], ['Capítulos', [M.stats.Chapters]]]
    .forEach(([k, v]) => { if (!v || !v[0]) return; dl.appendChild($('dt', '', k)); dl.appendChild($('dd', '', v.join(', '))); });
  c.appendChild(dl);
  const l = $('a', 'cta', 'Comentar no AO3 ↗'); l.href = M.url; l.target = '_blank'; l.rel = 'noopener'; c.appendChild(l);
  app.appendChild(c);

  const t = $('section', 'card help');
  t.appendChild($('h2', '', 'Como ler'));
  const ul = $('ul');
  ['Toque em Aa para trocar o tema, a fonte, o tamanho, as margens e a cor da página.',
   'No computador, use ← e → para mudar de capítulo.',
   'O site lembra onde você parou em cada capítulo, neste navegador.',
   'As conversas de MSN, posts do Tumblr, celulares e outras interfaces estão como a autora criou. Em telas pequenas, deslize para os lados para ver tudo.']
    .forEach(s => ul.appendChild($('li', '', s)));
  t.appendChild(ul);
  app.appendChild(t);
}

// ------------------------------------------------------------ characters
const PEOPLE = window.CHARS ? CHARS.leads : [];
PEOPLE.forEach(p => {
  p.chs = CH.filter(c => p.match.some(m => c.body.includes(m))).map(c => c.n);
  p.first = p.chs[0] || 1;
});
const initials = n => n.replace(/[“”"()]/g, '').split(/\s+/).filter(w => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(w)).slice(0, 2).map(w => w[0]).join('');
function avatar(p, cls) {
  const f = $('div', 'av ' + (cls || ''));
  if (p.img) { const i = $('img'); i.src = p.img; i.alt = ''; i.loading = 'lazy'; f.appendChild(i); }
  else f.appendChild($('span', '', initials(p.name)));
  return f;
}
function appears(p) {
  const w = $('p', 'appears');
  w.appendChild(document.createTextNode(`Em ${p.chs.length} de ${CH.length} capítulos · desde o `));
  const b = $('button', 'link', `capítulo ${p.first}`); b.onclick = () => openChapter(p.first);
  w.appendChild(b);
  return w;
}
function people() {
  app.replaceChildren();
  app.appendChild($('h2', 'sec', 'Personagens'));
  app.appendChild($('p', 'lede', 'Quem é quem na história. Os nicks, e-mails e fotos vêm das conversas de MSN da própria fic.'));

  const out = $('div'); app.appendChild(out);

  function leadCard(p) {
    const c = $('section', 'card lead'); c.id = 'p-' + p.id;
    const prof = $('div', 'msnc');
    const av = avatar(p, 'big'); prof.appendChild(av);
    const who = $('div', 'who');
    who.appendChild($('b', 'nick', p.msn.nick));
    who.appendChild($('span', 'status', '(Online)'));
    who.appendChild($('span', 'mail', '<' + p.msn.email + '>'));
    who.appendChild($('i', 'pm', p.msn.msg));
    prof.appendChild(who);
    c.appendChild(prof);
    const tx = $('div', 'tx');
    tx.appendChild($('h3', '', p.name));
    tx.appendChild($('p', 'role', p.role + (p.aka ? ' · também: ' + p.aka.join(', ') : '')));
    p.about.forEach(t => tx.appendChild($('p', '', t)));
    const dl = $('dl', 'pfacts'); p.facts.forEach(([k, v]) => { dl.appendChild($('dt', '', k)); dl.appendChild($('dd', '', v)); });
    tx.appendChild(dl);
    tx.appendChild(appears(p));
    if (p.alt) {  // Eduarda has two MSN identities; the other one glitches through her photo
      const t = $('button', 'swap', 'Ver como Trinity'); let alt = false;
      const img = av.querySelector('img'), nick = who.querySelector('.nick'), mail = who.querySelector('.mail'), pm = who.querySelector('.pm');
      const ghost = $('img', 'ghost'); ghost.alt = ''; av.appendChild(ghost);
      const show = () => {
        img.src = alt ? p.alt : p.img; ghost.src = alt ? p.img : p.alt;
        nick.textContent = alt ? p.msn.nick : 'duda 🌙'; mail.textContent = alt ? '<' + p.msn.email + '>' : '<fragduda37@msn.com>'; pm.textContent = alt ? p.msn.msg : '';
        t.textContent = alt ? 'Ver como Duda' : 'Ver como Trinity';
      };
      t.onclick = () => { alt = !alt; show(); }; show();
      prof.appendChild(t);
    }
    c.appendChild(tx);
    return c;
  }
  PEOPLE.forEach(p => out.appendChild(leadCard(p)));
}

// ------------------------------------------------------------ reader
let current = 0;
const SPEAKER = { lore: '#c2185b', trinity: '#1565c0', duda: '#00838f' };
const SPEAKERS = ['#2e7d32', '#d84315', '#6a1b9a', '#827717', '#3949ab', '#6d4c41', '#ad1457'];
function chapter(n) {
  const ch = CH.find(c => c.n === n); if (!ch) return home();
  current = n;
  app.replaceChildren();
  const rd = $('article', 'reader');
  const hd = $('header', 'ch-head');
  hd.appendChild($('p', 'kicker', M.title));
  hd.appendChild($('h1', '', `Capítulo ${n}`));
  if (ch.title) hd.appendChild($('p', 'ch-title', ch.title));
  const by = $('p', 'ch-by', 'por ');
  const au = $('a', '', M.author); au.href = M.authorUrl; au.target = '_blank'; au.rel = 'noopener'; by.appendChild(au); hd.appendChild(by);
  const meta = $('p', 'ch-meta', `${minutes(ch.words)} min de leitura · ${fmt(ch.words)} palavras`);
  if (ch.kinds.length) { meta.appendChild(document.createTextNode(' · ')); meta.appendChild(kindTags(ch)); }
  hd.appendChild(meta);
  hd.appendChild($('div', 'orn', '◆ ◆ ◆'));
  rd.appendChild(hd);

  const st = $('div', 'story userstuff2'); st.id = 'workskin'; st.lang = 'pt-BR';
  st.innerHTML = ch.body;
  st.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  st.querySelectorAll('img').forEach(i => { i.loading = 'lazy'; i.decoding = 'async'; });
  const statusOf = t => (t.match(/\((ausente|offline|online|dispon[ií]vel)\)/gi) || []).pop()?.replace(/[()]/g, '').toLowerCase();
  st.querySelectorAll('.messenger-window').forEach(w => {  // the title-bar dot follows the contact's status
    const s = statusOf(w.querySelector('.user-info')?.textContent || ''); if (s) w.dataset.status = s;
  });
  st.querySelectorAll('details.msn-chat-entry').forEach(d => {  // same for chats opened from the contact list
    const sum = d.querySelector('summary'), s = statusOf(sum.textContent) || (sum.classList.contains('msn-away') ? 'ausente' : '');
    if (s) d.querySelector('.msn-chat-window')?.setAttribute('data-status', s);
  });
  st.querySelectorAll('.sender-name, .msn-chat-sender-name').forEach(n => {  // each MSN speaker keeps one colour across the story
    const name = n.textContent.replace(/\s*diz:\s*$/, '').trim();
    const key = /tr!n!ty/i.test(name) ? 'trinity' : /^lore\b/i.test(name) ? 'lore' : /^duda\b/i.test(name) ? 'duda' : name;
    n.style.color = SPEAKER[key] || SPEAKERS[[...key].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 0) % SPEAKERS.length];
  });
  st.querySelectorAll('.msn-messenger-wrap').forEach((w, i) => {  // contact list: one chat open at a time, beside the list on desktop
    const chats = w.querySelectorAll('details.msn-chat-entry');
    chats.forEach(d => {
      d.setAttribute('name', 'msn' + i);
      const x = $('button', 'msn-chat-close', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar conversa');
      x.onclick = () => { d.open = false; };
      d.querySelector('.msn-chat-title-bar')?.appendChild(x);
    });
    if (chats[0] && matchMedia('(min-width: 721px)').matches) chats[0].open = true;
  });
  rd.appendChild(st);

  if (n === CH[CH.length - 1].n) {
    const end = $('section', 'card fin');
    end.appendChild($('h2', '', 'Fim (por enquanto)'));
    if (F.afterword) end.appendChild(htmlBlock('summary', F.afterword));
    const l = $('a', 'cta', 'Deixar um comentário no AO3 ↗'); l.href = M.url; l.target = '_blank'; l.rel = 'noopener';
    end.appendChild(l); rd.appendChild(end);
  }

  const nav = $('nav', 'pn'); nav.setAttribute('aria-label', 'Navegação entre capítulos');
  const prev = $('button', '', '← Anterior'), mid = $('button', '', 'Capítulos'), next = $('button', 'next', 'Próximo →');
  prev.disabled = n <= CH[0].n; next.disabled = n >= CH[CH.length - 1].n;
  prev.onclick = () => openChapter(n - 1); next.onclick = () => openChapter(n + 1); mid.onclick = () => go('capitulos');
  nav.append(prev, mid, next); rd.appendChild(nav);
  app.appendChild(rd);
  store.set('apol_last', n);
  if (resume && pos[n]) restore(pos[n]);
  resume = false;
}
function restore(p) {
  const jump = () => { const st = app.querySelector('.reader'); if (!st) return; const r = st.getBoundingClientRect(); window.scrollTo({ top: scrollY + r.top + p * (r.height - innerHeight), behavior: 'instant' }); };
  requestAnimationFrame(jump); setTimeout(jump, 250);
  toast(`Voltando para onde você parou (${Math.round(p * 100)}%)`);
}

// Widgets use href="#" for fake links; keep them from changing the route.
app.addEventListener('click', e => { const a = e.target.closest('a[href="#"], a[href=""]'); if (a) e.preventDefault(); });

// ------------------------------------------------------------ theme effects on the home hero
let fxStop = null;
// The CRT beams take turns at random: one lights up only after the other has fully faded.
function screenLight(art) {
  const beams = art && [...art.querySelectorAll('.beam-a, .beam-b')];
  if (!beams || !beams.length) return;
  if (calm.matches) { beams[0].classList.add('on'); return; }
  const rnd = (a, b) => a + Math.random() * (b - a), FADE = 900;
  let i = Math.random() < .5 ? 0 : 1;
  (function next() {
    if (!art.isConnected) return;  // left the home page
    beams[i].classList.add('on');
    setTimeout(() => {
      beams[i].classList.remove('on');
      if (Math.random() < .75) i = 1 - i;  // usually the other screen, sometimes the same one again
      setTimeout(next, FADE + rnd(400, 2500));
    }, rnd(1500, 4000));
  })();
}
function heroFx() {
  if (fxStop) { fxStop(); fxStop = null; }
  const d = app.querySelector('.hero .deco'); if (!d) return;
  d.replaceChildren();
  app.querySelectorAll('.hero > .msn-toast, .hero > .nudge').forEach(e => e.remove());
  const t = P.theme;
  if (t === 'hacker') fxStop = matrix(d);
  else if (t === 'romance') dream(d);
  else if (t === 'msn') msnToast(app.querySelector('.hero'));
}
function matrix(d) {
  const cv = $('canvas'); d.appendChild(cv);
  const c = cv.getContext('2d'), glyphs = 'アカサタナハマヤラワ01ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃTRINITY<>/{}#$';
  let cols = [], raf = 0, last = 0, W = 0, H = 0;
  const size = () => { W = cv.width = d.clientWidth; H = cv.height = d.clientHeight; cols = Array.from({ length: Math.ceil(W / 16) }, () => Math.random() * H / 16); };
  size();
  const ro = new ResizeObserver(size); ro.observe(d);
  const step = ts => {
    raf = requestAnimationFrame(step);
    if (ts - last < 55) return; last = ts;
    c.fillStyle = 'rgba(0,8,2,.14)'; c.fillRect(0, 0, W, H);
    c.font = '15px "IBM Plex Mono", monospace';
    cols.forEach((y, i) => {
      const ch = glyphs[Math.random() * glyphs.length | 0];
      c.fillStyle = Math.random() > .97 ? '#d8ffe0' : '#00e85a';
      c.fillText(ch, i * 16, y * 16);
      cols[i] = y * 16 > H && Math.random() > .975 ? 0 : y + 1;
    });
  };
  if (calm.matches) { for (let i = 0; i < 60; i++) step(i * 60); cancelAnimationFrame(raf); }
  else raf = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
function dream(d) {  // romance: moon, drifting clouds, twinkling stars
  d.appendChild($('div', 'moon'));
  [[18, 260, 90, 70], [42, 380, 120, 95], [64, 220, 70, 120]].forEach(([top, w, h, dur], i) => {
    const c = $('div', 'cloud');
    Object.assign(c.style, { top: top + '%', width: w + 'px', height: h + 'px', animationDuration: dur + 's', animationDelay: (-i * dur / 2.5) + 's' });
    d.appendChild(c);
  });
  for (let i = 0; i < 16; i++) {  // hearts drifting up, as in the first version
    const h = $('span', 'fheart', i % 3 ? '♥' : '❦');
    Object.assign(h.style, { left: Math.random() * 96 + '%', fontSize: (14 + Math.random() * 26) + 'px', animationDuration: (11 + Math.random() * 9) + 's', animationDelay: (-Math.random() * 18) + 's' });
    d.appendChild(h);
  }
  for (let i = 0; i < 46; i++) {
    const s = $('span', 'star' + (i % 9 ? '' : ' big'));
    Object.assign(s.style, { left: Math.random() * 100 + '%', top: Math.random() * 62 + '%', animationDuration: (2 + Math.random() * 4) + 's', animationDelay: (-Math.random() * 4) + 's' });
    d.appendChild(s);
  }
}
function msnToast(d) {
  const w = $('div', 'msn-toast');
  w.innerHTML = '<b>Windows Live Messenger</b><span><i></i><strong>Lore 🌹</strong> acabou de entrar.</span>';
  d.appendChild(w);
  const nudge = $('button', 'nudge', 'Chamar a atenção');
  nudge.onclick = () => { if (calm.matches) return; document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); };
  d.appendChild(nudge);
}

// ------------------------------------------------------------ router and scroll
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  let m;
  document.querySelectorAll('nav button[data-r]').forEach(b => b.classList.toggle('on', b.dataset.r === (h === 'sobre' || h === 'personagens' ? h : 'home')));
  document.body.classList.remove('reading', 'home');
  current = 0;
  window.scrollTo({ top: 0, behavior: 'instant' });  // restore() jumps later, after layout
  if ((m = h.match(/^cap\/(\d+)$/))) { document.body.classList.add('reading'); chapter(+m[1]); }
  else if (h === 'sobre') about();
  else if (h === 'personagens') people();
  else { document.body.classList.add('home'); home(); if (h === 'capitulos') setTimeout(() => document.getElementById('capitulos')?.scrollIntoView({ behavior: calm.matches ? 'instant' : 'smooth' })); }
  document.title = current ? `Capítulo ${current} · ${M.title}` : M.title;
  app.focus({ preventScroll: true });
  onScroll();
}
let lastY = 0, saveT = 0;
// Home: as you scroll, the hero title glides up and shrinks into the header, where the site name sits
// on other pages. A fixed copy makes the trip (the hero's fade mask and the frosted header would hide the real one).
let dock = null;
function dockTitle() {
  const t = app.querySelector('.hero h1'), name = document.querySelector('.brand-name');
  if (dock && dock.src !== t) { dock.remove(); dock = null; }
  const T = name.getBoundingClientRect(), nav = document.querySelector('header.top nav');
  if (!document.body.classList.contains('home') || !t || !T.width) { name.style.opacity = nav.style.transform = ''; if (t) t.style.visibility = ''; return; }
  if (!dock) {
    dock = t.cloneNode(true); dock.className = 'dock-title'; dock.src = t; dock.setAttribute('aria-hidden', 'true');
    const cs = getComputedStyle(t);
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'color', 'textShadow', 'textWrap', 'width'])
      dock.style[k] = cs[k];
    const dot = t.querySelector('.dot'); if (dot) dock.querySelector('.dot').style.color = getComputedStyle(dot).color;
    document.body.appendChild(dock);
  }
  const y = scrollY, R = t.getBoundingClientRect(), top0 = R.top + y;
  const s = parseFloat(getComputedStyle(name).fontSize) / parseFloat(getComputedStyle(t).fontSize);
  const endTop = T.top + T.height / 2 - R.height * s / 2;
  const clamp = v => Math.min(1, Math.max(0, v)), smooth = v => v * v * (3 - 2 * v);
  const p = clamp(y / Math.max(1, (top0 - endTop) * 1.5)), e = smooth(p);  // a longer, eased trip
  const lerp = (a, b) => a + (b - a) * e;
  t.style.visibility = y > 0 ? 'hidden' : '';
  dock.style.display = y > 0 ? '' : 'none';
  dock.style.transform = `translate(${lerp(R.left, T.left)}px, ${lerp(top0, endTop)}px) scale(${s ** e})`;  // even shrinking
  const mid = nav.parentElement.clientWidth / 2 - (nav.offsetLeft + nav.offsetWidth / 2);
  nav.style.transform = `translateX(${mid * (1 - e)}px)`;  // the menu starts centred and slides back as the title docks
  const f = smooth(clamp((p - .65) / .35));  // the last third: the copy hands over to the header's name
  dock.style.opacity = 1 - f; name.style.opacity = f;
}
function onScroll() {
  dockTitle();
  const top = document.getElementById('top');
  top.classList.toggle('solid', scrollY > 24);
  top.classList.toggle('hide', !!current && scrollY > lastY && scrollY > 120 && !document.body.classList.contains('sheet-open'));
  lastY = scrollY;
  const a = app.querySelector('.reader');
  if (!a || !current) { bar.style.width = '0'; pct.textContent = ''; return; }
  const r = a.getBoundingClientRect(), t = r.height - innerHeight;
  const p = Math.min(1, Math.max(0, -r.top / Math.max(1, t)));
  bar.style.width = (p * 100) + '%';
  pct.textContent = `Cap. ${current} · ${Math.round(p * 100)}%`;
  clearTimeout(saveT);
  const n = current;
  saveT = setTimeout(() => { pos[n] = +p.toFixed(3); store.set('apol_pos', pos); }, 300);
  if (p > .97 && !read.includes(n)) { read.push(n); store.set('apol_read', read); toast(`✓ Capítulo ${n} lido`); }
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { if (dock) { dock.remove(); dock = null; } onScroll(); });
window.addEventListener('hashchange', route);
window.addEventListener('hashchange', () => window.va?.('pageview', {}));  // Vercel Analytics only counts the first load on its own
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));

// ------------------------------------------------------------ settings sheet
const sheet = document.getElementById('settings'), scrim = document.getElementById('scrim'), opener = document.getElementById('open-settings');
function openSheet() { sheet.hidden = scrim.hidden = false; document.body.classList.add('sheet-open'); opener.setAttribute('aria-expanded', 'true'); sheet.querySelector('[aria-pressed="true"]')?.focus(); }
function closeSheet() { sheet.hidden = scrim.hidden = true; document.body.classList.remove('sheet-open'); opener.setAttribute('aria-expanded', 'false'); opener.focus(); }
opener.onclick = () => sheet.hidden ? openSheet() : closeSheet();
document.getElementById('close-settings').onclick = closeSheet;
scrim.onclick = closeSheet;
sheet.querySelectorAll('[data-pref]').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPref(g.dataset.pref, b.dataset.v); }));
sheet.querySelectorAll('[data-step]').forEach(b => b.onclick = () => setPref('fs', Math.min(30, Math.max(14, P.fs + +b.dataset.d))));
document.getElementById('fs').addEventListener('input', e => setPref('fs', +e.target.value));
document.getElementById('shuffle').onclick = e => {
  const opts = [...document.querySelectorAll('.themes button')].filter(b => b.dataset.v !== P.theme);
  const pick = opts[Math.random() * opts.length | 0];
  setPref('theme', pick.dataset.v);
  toast('Tema: ' + pick.textContent.trim());
  const b = e.currentTarget; b.classList.remove('roll'); void b.offsetWidth; b.classList.add('roll');
};
document.getElementById('reset').onclick = () => { const th = P.theme; P = Object.assign({}, DEF, { theme: th }); applyPrefs(); toast('Leitura restaurada'); };

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !sheet.hidden) return closeSheet();
  if (!sheet.hidden && e.key === 'Tab') {  // keep focus inside the sheet
    const f = [...sheet.querySelectorAll('button, input')]; const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    return;
  }
  if (!current || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight' && current < CH[CH.length - 1].n) openChapter(current + 1);
  if (e.key === 'ArrowLeft' && current > CH[0].n) openChapter(current - 1);
});

applyPrefs();
route();
})();
