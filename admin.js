(async () => {
const BASE = FIC.chapters.length, EX = (window.FIC_EXTRA || []).slice();
const $ = id => document.getElementById(id);
const sel = $('n'), titleIn = $('title'), src = $('src'), edFrame = $('ed'), frame = $('frame');
const status = $('status'), savedAt = $('saved'), ask = $('ask');
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
const MAX_IMAGES = 3000000;
const KINDS = [
  ['messenger-wrapper', 'MSN (conversa)'], ['msn-messenger-wrap', 'MSN (lista de contatos)'], ['diana-wrapper', 'Tumblr'],
  ['tw-body', 'Twitter'], ['v3-wrapper', 'Celular Motorola'], ['bb-container', 'Celular Blackberry'],
  ['ya-container', 'Yahoo Respostas'], ['wmp-wrapper', 'Media Player'], ['env-scene-wrap', 'Carta'],
];
const say = (t, bad) => { status.textContent = t; status.classList.toggle('bad', !!bad); };
const published = n => EX.find(c => c.n === n);
const hasContent = el => !!(el.textContent.trim() || el.querySelector('img'));

// ---- drafts: text in localStorage, pictures in IndexedDB, both only in this browser
let drafts = {};
try { drafts = JSON.parse(localStorage.getItem('apol_admin')) || {}; } catch (e) {}
for (const k in drafts) if (typeof drafts[k] === 'string') drafts[k] = { title: '', body: drafts[k], at: 0 };
const saveDrafts = () => { try { localStorage.setItem('apol_admin', JSON.stringify(drafts)); return true; } catch (e) { return false; } };

const pending = new Map();  // picture name -> { file, url }, not yet on the site
const idb = new Promise(ok => {
  try {
    const r = indexedDB.open('apol_admin', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => ok(r.result); r.onerror = () => ok(null);
  } catch (e) { ok(null); }
});
const imgDb = async (mode, fn) => {
  const db = await idb; if (!db) return;
  await new Promise(ok => { const tx = db.transaction('img', mode); fn(tx.objectStore('img')); tx.oncomplete = tx.onerror = tx.onabort = () => ok(); });
};
await imgDb('readonly', s => {
  const keys = s.getAllKeys(), all = s.getAll();
  all.onsuccess = () => keys.result.forEach((name, i) => pending.set(name, { file: all.result[i], url: URL.createObjectURL(all.result[i]) }));
});

// ---- visual editor: the story container in a frame, with the work skin, so widgets look real
let ed, box;
await new Promise(ok => {
  edFrame.onload = ok;
  edFrame.srcdoc = `<!doctype html><html lang="pt-BR" data-theme="classico" data-font="literata" data-align="left" data-para="space"><head><meta charset="utf-8">
<link rel="stylesheet" href="workskin.css"><link rel="stylesheet" href="reader.css">
<style>body { margin: 0; } #app { max-width: none; padding: 18px 16px 60px; } .reader { padding-top: 0; }
#workskin { min-height: 70vh; outline: none; }
#workskin > .widget { outline: 1px dashed rgba(0, 0, 0, .25); outline-offset: 4px; }</style></head>
<body class="reading"><main id="app"><article class="reader"><div class="story userstuff2" id="workskin" contenteditable="true" lang="pt-BR"></div></article></main></body></html>`;
});
ed = edFrame.contentDocument; box = ed.getElementById('workskin');
ed.execCommand('defaultParagraphSeparator', false, 'p');

const tail = () => { if (!box.lastElementChild || box.lastElementChild.tagName !== 'P') box.insertAdjacentHTML('beforeend', '<p><br></p>'); };  // a place to type after a widget
function toEditor(html) {
  box.innerHTML = prepChapter(html).body;
  box.querySelectorAll('img').forEach(img => {
    const name = (img.getAttribute('src') || '').replace(/^img\//, ''), p = pending.get(name);
    if (p) { img.dataset.name = name; img.src = p.url; }
  });
  tail();
}
function fromEditor() {
  const c = box.cloneNode(true);
  c.querySelectorAll('img[data-name]').forEach(img => { img.setAttribute('src', 'img/' + img.dataset.name); img.removeAttribute('data-name'); });
  c.querySelectorAll(':scope > div:not([class])').forEach(d => { const p = document.createElement('p'); p.append(...d.childNodes); d.replaceWith(p); });  // a plain line, not a widget
  const d = document.createElement('div'); d.innerHTML = prepChapter(c.innerHTML).body;
  return [...d.children].filter(e => e.tagName !== 'P' || hasContent(e)).map(e => e.outerHTML).join('\n\n');
}
let lastRange = null;  // where the cursor was, to go back there after a toolbar action
const setRange = r => { box.focus(); const s = ed.getSelection(); s.removeAllRanges(); s.addRange(r); };
const refocus = () => { if (lastRange) setRange(lastRange); else box.focus(); };
const caret = el => { const r = ed.createRange(); r.selectNodeContents(el); r.collapse(false); setRange(r); };
const within = cls => {
  const s = ed.getSelection(), nd = s.rangeCount ? s.anchorNode : null, el = nd && (nd.nodeType === 1 ? nd : nd.parentElement);
  return el && box.contains(el) ? el.closest('.' + cls) : null;
};

// ---- state
let n = 0, body = '', mode = 'visual', dirty = false, timer = 0;
const read = () => { body = mode === 'visual' ? fromEditor() : src.value; };
const show = () => { if (mode === 'visual') toEditor(body); else src.value = body; };
function flush() {
  clearTimeout(timer);
  if (!dirty) return;
  dirty = false; read();
  if (body || titleIn.value) drafts[n] = { title: titleIn.value, body, at: Date.now() }; else delete drafts[n];
  if (saveDrafts()) savedNote(); else say('Não foi possível salvar o rascunho no navegador. Baixe uma cópia.', true);
  preview();
}
const touch = () => { dirty = true; clearTimeout(timer); timer = setTimeout(flush, 500); };
function savedNote() {
  const d = drafts[n];
  savedAt.textContent = d && d.at ? `Rascunho salvo no navegador às ${new Date(d.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : '';
}
function fillList(pick) {
  const next = BASE + EX.length + 1;
  sel.replaceChildren(...EX.map(c => new Option(`Editar capítulo ${c.n}${c.title ? ' · ' + c.title : ''}`, c.n)), new Option(`Novo capítulo ${next}`, next));
  sel.value = pick && pick <= next ? pick : next;
  load();
}
function load() {
  n = +sel.value;
  const d = drafts[n], p = published(n);
  titleIn.value = d ? d.title : (p && p.title) || '';
  body = d ? d.body : (p && p.body) || '';
  dirty = false; show(); savedNote(); preview();
}
sel.addEventListener('change', () => { flush(); load(); });
titleIn.addEventListener('input', touch);
src.addEventListener('input', touch);
box.addEventListener('input', () => { tail(); touch(); });
addEventListener('pagehide', flush);

// ---- preview: the real reader in a frame, with the draft passed through sessionStorage
function preview() {
  try { sessionStorage.setItem('apol_draft', JSON.stringify({ n, title: titleIn.value, body })); } catch (e) {}
  if ($('preview').hidden) return;
  let y = 0;
  try { if (frame.contentWindow.location.hash === '#cap/' + n) y = frame.contentWindow.scrollY; } catch (e) {}
  frame.onload = () => {
    const w = frame.contentWindow;
    w.document.querySelectorAll('#workskin img').forEach(img => {  // pictures that are not uploaded yet
      const p = pending.get((img.getAttribute('src') || '').replace(/^img\//, ''));
      if (p) { img.loading = 'eager'; img.src = p.url; }
    });
    w.scrollTo(0, y);
  };
  frame.src = `index.html?t=${Date.now()}#cap/${n}`;
}
function showPreview(on) {
  $('preview').hidden = !on;
  document.querySelector('main').classList.toggle('solo', !on);
  $('toggle-preview').querySelector('span').textContent = on ? 'Ocultar prévia' : 'Mostrar prévia';
  $('toggle-preview').setAttribute('aria-expanded', on);
  try { localStorage.setItem('apol_admin_preview', on ? '1' : '0'); } catch (e) {}
  if (on) preview();
}
$('toggle-preview').addEventListener('click', () => showPreview($('preview').hidden));
document.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-w]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('stage').classList.toggle('phone', b.dataset.w === 'phone');
}));

// ---- toolbar
document.querySelectorAll('.tools button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
const visualOnly = [...document.querySelectorAll('[data-cmd]'), $('link')];
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.mode === mode) return;
  read(); mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b));
  edFrame.hidden = mode !== 'visual'; src.hidden = mode !== 'html';
  visualOnly.forEach(x => { x.disabled = mode !== 'visual'; });
  $('line').hidden = $('sender').hidden = true;
  show();
}));
document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => {
  refocus(); ed.execCommand(b.dataset.cmd); touch();
}));
$('link').addEventListener('click', () => {
  const url = prompt('Endereço do link (https://…)');
  if (!url) return;
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return say('O link precisa começar com https://', true);
  refocus(); ed.execCommand('createLink', false, url); touch();
});

// a block (widget or picture) goes after the paragraph that has the cursor
function insertBlock(html, asText) {
  if (mode === 'html') {
    src.setRangeText('\n\n' + asText + '\n\n', src.selectionStart, src.selectionEnd, 'end'); src.focus();
  } else {
    const t = ed.createElement('template'); t.innerHTML = html;
    const node = t.content.firstElementChild;
    const s = ed.getSelection();
    let at = s.rangeCount && box.contains(s.anchorNode) && s.anchorNode !== box ? s.anchorNode : null;
    while (at && at.parentNode !== box) at = at.parentNode;
    if (!at) at = box.lastElementChild;
    if (at.tagName === 'P' && !hasContent(at)) at.before(node); else at.after(node);
    if (!node.nextElementSibling || node.nextElementSibling.tagName !== 'P') node.insertAdjacentHTML('afterend', '<p><br></p>');
    caret(node.nextElementSibling);
    node.scrollIntoView({ block: 'nearest' });
  }
  touch();
}

// widgets: the shortest example of each kind in the story is the starting point
const TPL = new Map();
{
  const t = document.createElement('template');
  for (const c of FIC.chapters) {
    t.innerHTML = c.body;
    for (const w of t.content.children) {
      const el = w.classList.contains('widget') && w.firstElementChild;
      const kind = el && KINDS.find(([cls]) => el.classList.contains(cls));
      if (!kind || (kind[0] === 'messenger-wrapper' && !el.querySelector('.msg-block'))) continue;
      const h = el.outerHTML;
      if (!TPL.has(kind[0]) || h.length < TPL.get(kind[0]).length) TPL.set(kind[0], h);
    }
  }
  if (TPL.has('messenger-wrapper')) {  // an MSN chat starts with two lines
    t.innerHTML = TPL.get('messenger-wrapper');
    t.content.querySelectorAll('.msg-block').forEach((b, i) => { if (i > 1) b.remove(); });
    TPL.set('messenger-wrapper', t.innerHTML);
  }
  KINDS.forEach(([cls, name]) => { if (TPL.has(cls)) $('widget').add(new Option(name, cls)); });
}
$('widget').addEventListener('change', e => {
  const h = TPL.get(e.target.value); e.target.value = '';
  if (h) insertBlock(`<div class="widget">${h}</div>`, h);
});

const msnPart = () => { const chat = within('messenger-wrapper'); return within('msg-block') || (chat && [...chat.querySelectorAll('.msg-block')].pop()) || null; };
// MSN: Enter starts a new message of the same person, "+ Fala" starts the other person's turn
ed.addEventListener('selectionchange', () => {
  const s = ed.getSelection();
  if (s.rangeCount && box.contains(s.anchorNode)) lastRange = s.getRangeAt(0).cloneRange();
  $('line').hidden = $('sender').hidden = mode !== 'visual' || !within('messenger-wrapper');
});
box.addEventListener('keydown', e => {
  const m = e.key === 'Enter' && !e.shiftKey && within('msg-text');
  if (!m) return;
  e.preventDefault();
  const nm = m.cloneNode(false); nm.innerHTML = '<p>▪&nbsp;</p>'; m.after(nm);
  caret(nm.firstChild); touch();
});
$('line').addEventListener('click', () => {
  const cur = msnPart(); if (!cur) return;
  const prev = cur.previousElementSibling, from = prev && prev.classList.contains('msg-block') ? prev : cur;
  const nb = from.cloneNode(true);
  nb.querySelectorAll('.msg-text').forEach((m, i) => { if (i) m.remove(); else m.innerHTML = '<p>▪&nbsp;</p>'; });
  cur.after(nb);
  caret(nb.querySelector('.msg-text p') || nb); touch();
});

// MSN: the names that speak in the story, most used first, to set who says the current part
{
  const count = new Map(), t = document.createElement('template');
  for (const c of FIC.chapters) {
    t.innerHTML = c.body;
    t.content.querySelectorAll('.sender-name').forEach(s => {
      const name = s.textContent.replace(/\s*diz:\s*$/, '').replace(/\\/g, '').trim();
      const key = name.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, '');  // one entry per person: the decoration around a nickname changes
      if (key) count.set(key, { name, uses: (count.get(key)?.uses || 0) + 1 });  // keeps the latest spelling
    });
  }
  [...count.values()].sort((a, b) => b.uses - a.uses).forEach(({ name }) => $('sender').add(new Option(name, name)));
  $('sender').add(new Option('Outro nome…', '?'));
}
$('sender').addEventListener('change', e => {
  let name = e.target.value; e.target.value = '';
  const cur = msnPart();
  if (!cur || !name) return;
  if (name === '?') name = (prompt('Nome de quem fala') || '').trim();
  if (!name) return;
  let s = cur.querySelector('.sender-name');
  if (!s) { s = ed.createElement('div'); s.className = 'sender-name'; cur.prepend(s); }
  s.innerHTML = '<p></p>'; s.firstChild.textContent = name + ' diz:';
  caret([...cur.querySelectorAll('.msg-text p, .msg-text')].pop() || cur); touch();
});

// text pasted from Word or Google Docs: keep bold, italic, links and paragraphs, drop their styling
box.addEventListener('paste', e => {
  const html = e.clipboardData.getData('text/html');
  if (!html) return;
  e.preventDefault();
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script, style, meta, link, title').forEach(x => x.remove());
  d.body.querySelectorAll('*').forEach(el => {
    const st = el.getAttribute('style') || '', guid = (el.id || '').startsWith('docs-internal-guid');
    let wrap = '';
    if (el.tagName === 'SPAN' && /font-weight:\s*(bold|[6-9]00)/.test(st)) wrap = 'strong';
    else if (el.tagName === 'SPAN' && /font-style:\s*italic/.test(st)) wrap = 'em';
    [...el.attributes].forEach(a => { if (!['class', 'href', 'src', 'alt'].includes(a.name)) el.removeAttribute(a.name); });
    if (wrap) { const w = d.createElement(wrap); w.append(...el.childNodes); el.replaceWith(w); }
    else if (guid || el.tagName === 'FONT' || (el.tagName === 'SPAN' && !el.className)) el.replaceWith(...el.childNodes);
  });
  ed.execCommand('insertHTML', false, d.body.innerHTML);
});

// ---- pictures: named by their content, kept in IndexedDB until they are published
$('file').addEventListener('change', async e => {
  for (const file of [...e.target.files]) {
    const ext = TYPES[file.type];
    if (!ext) { say(`Formato não aceito: ${file.name}. Use JPG, PNG, GIF ou WebP.`, true); continue; }
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
    const name = [...hash.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('') + '.' + ext;
    const url = URL.createObjectURL(file);
    pending.set(name, { file, url });
    await imgDb('readwrite', s => s.put(file, name));
    insertBlock(`<figure class="pic"><img src="${url}" data-name="${name}" alt=""></figure>`, `<p><img src="img/${name}" alt=""></p>`);
  }
  e.target.value = '';
});
const base64 = file => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(r.result.slice(r.result.indexOf(',') + 1)); r.onerror = no;
  r.readAsDataURL(file);
});

// ---- a copy outside the browser
$('download').addEventListener('click', () => {
  dirty = true; flush();
  const head = `<!-- capítulo ${n}${titleIn.value ? ': ' + titleIn.value.replace(/-->/g, '') : ''} -->\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([head + body], { type: 'text/html' }));
  a.download = `capitulo-${n}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say('Cópia baixada. As imagens não vão no arquivo: guarde os arquivos das imagens também.');
});
$('open').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  read();
  if (body && !confirm('Substituir o texto atual pelo texto do arquivo?')) return;
  const text = await file.text(), m = /^<!-- capítulo \d+(?:: (.*?))? -->\n?/.exec(text);
  if (m && m[1]) titleIn.value = m[1];
  body = m ? text.slice(m[0].length) : text;
  show(); touch();
});

// ---- publish: the password is asked in a dialog
$('publish').addEventListener('click', () => {
  dirty = true; flush();
  if (!body.trim()) return say('O capítulo está vazio.', true);
  $('ask-title').textContent = `Publicar capítulo ${n}${titleIn.value ? ' · ' + titleIn.value : ''}`;
  $('ask-err').textContent = ''; $('pw').value = '';
  ask.showModal();
});
$('ask-cancel').addEventListener('click', () => ask.close());
$('ask-form').addEventListener('submit', async e => {
  e.preventDefault();
  const ok = $('ask-ok'), stop = (t, keep) => { if (keep) $('ask-err').textContent = t; else { ask.close(); say(t, true); } };
  ok.disabled = true; $('ask-err').textContent = '';
  try {
    const used = [...new Set([...body.matchAll(/src="img\/([^"]+)"/g)].map(m => m[1]))];
    const images = [];
    let size = 0;
    for (const name of used) {
      const p = pending.get(name);
      if (!p) {  // not in this browser: it must be on the site already
        if (!(await fetch('img/' + encodeURIComponent(name), { method: 'HEAD' })).ok) return stop(`A imagem ${name} não está no site. Insira a imagem de novo.`);
        continue;
      }
      size += p.file.size;
      images.push({ name, data: await base64(p.file) });
    }
    if (size > MAX_IMAGES) return stop('As imagens passam de 3 MB. Publique com menos imagens ou reduza o tamanho.');

    const r = await fetch('api/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('pw').value, n, title: titleIn.value, body, images }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return stop(j.error || 'Não foi possível publicar. Tente de novo.', r.status === 401);

    const old = published(n), entry = old || { n };
    entry.title = j.title; entry.body = j.body;
    if (!old) EX.push(entry);
    delete drafts[n]; saveDrafts();
    used.forEach(name => pending.delete(name));
    await imgDb('readwrite', s => used.forEach(name => s.delete(name)));
    ask.close(); fillList(n);
    say(`Capítulo ${n} ${j.updated ? 'atualizado' : 'publicado'}. Ele aparece no site em cerca de um minuto.` +
      (j.removed ? ' Algumas tags ou atributos não permitidos foram removidos: confira a prévia.' : ''));
  } catch (err) {
    stop('Sem conexão com o servidor. Tente de novo.');
  } finally {
    ok.disabled = false;
  }
});

let previewOn = true;
try { previewOn = localStorage.getItem('apol_admin_preview') !== '0'; } catch (e) {}
fillList(Object.keys(drafts).map(Number).find(k => k > BASE));
if (!previewOn) showPreview(false);
})();
