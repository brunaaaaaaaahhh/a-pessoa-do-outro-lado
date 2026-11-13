(() => {
  'use strict';
  const config = window.COMMENTS_CONFIG || {};
  const work = config.workId || 'a-pessoa-do-outro-lado';
  let service, opening = 0, unsubscribe, active, sending = false, ready = false;
  const drafts = new Map();
  const hoverable = matchMedia('(hover: hover)');
  // Wide screens: the panel sits beside the text, below the header. Narrow screens keep the modal sheet.
  const docked = matchMedia('(min-width: 900px)');
  // The text reflows when the panel pushes it, so keep the active paragraph where the reader sees it.
  let anchor;
  function keepPlace(change) {
    const y = anchor?.isConnected ? anchor.getBoundingClientRect().top : null;
    change();
    if (y != null) scrollBy(0, anchor.getBoundingClientRect().top - y);
  }
  function setDock(on) {
    if (active) anchor = active.paragraph;
    keepPlace(() => document.documentElement.classList.toggle('pc-docked', on));
  }
  // Lucide "message-circle" (ISC licence).
  const ICON = '<svg class="pc-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
  const counts = new Map(), queue = [], targets = new WeakMap();
  let running = 0, countsOff = false, watcher, sizer;
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const dialog = el('dialog', 'pc-dialog');
  dialog.id = 'paragraph-comments';
  dialog.setAttribute('aria-labelledby', 'pc-title');
  dialog.tabIndex = -1; // Lets the panel itself take focus on open, so no ring shows on the close button.
  const head = el('header', 'pc-head');
  const title = el('h2', '', 'Comentários do parágrafo'); title.id = 'pc-title';
  const close = el('button', 'pc-close'); close.type = 'button';
  close.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  close.setAttribute('aria-label', 'Fechar comentários');
  head.append(title, close);
  const quote = el('blockquote', 'pc-quote');
  const status = el('p', 'pc-status'); status.setAttribute('role', 'status');
  const retry = el('button', 'pc-retry', 'Tentar novamente'); retry.type = 'button'; retry.hidden = true;
  const list = el('div', 'pc-list'); list.setAttribute('aria-label', 'Comentários publicados');
  const form = el('form', 'pc-form');
  const nameLabel = el('label', '', 'Seu nome ou apelido');
  const name = el('input'); name.id = 'pc-name'; name.required = true; name.maxLength = 60;
  name.autocomplete = 'nickname'; nameLabel.htmlFor = name.id;
  try { name.value = localStorage.getItem('apol_comment_name') || ''; } catch (_) {}
  const textLabel = el('label', '', 'Seu comentário');
  const text = el('textarea'); text.id = 'pc-text'; text.rows = 4; text.required = true; text.maxLength = 2000;
  text.placeholder = 'O que você achou deste trecho?'; textLabel.htmlFor = text.id;
  const hint = el('p', 'pc-hint', 'Seu nome e comentário ficarão públicos. Não precisa criar uma conta.');
  const error = el('p', 'pc-error'); error.setAttribute('role', 'alert');
  const send = el('button', 'pc-send', 'Enviar comentário'); send.type = 'submit';
  form.append(nameLabel, name, textLabel, text, hint, error, send);
  dialog.append(head, quote, status, retry, list, form);
  document.body.append(dialog);

  function message(e) {
    const code = String(e?.code || '');
    if (code.includes('permission-denied')) return 'O banco recusou a operação. Confira as regras do Firestore.';
    if (code.includes('operation-not-allowed')) return 'Ative o login Anônimo no Firebase Authentication.';
    if (code.includes('unauthorized-domain')) return 'Autorize o domínio do site no Firebase Authentication.';
    if (code.includes('invalid-api-key') || code.includes('project-not-found')) return 'Confira a configuração do Firebase deste site.';
    if (code.includes('quota') || code.includes('resource-exhausted')) return 'O serviço atingiu o limite de uso. Tente mais tarde.';
    return 'Não foi possível conectar ao serviço de comentários. Confira sua conexão e tente novamente.';
  }
  function configured() {
    return config.firebase?.apiKey && config.firebase?.projectId && config.firebase?.appId;
  }
  async function backend() {
    if (!service) {
      service = (async () => {
        const base = 'https://www.gstatic.com/firebasejs/12.11.0/';
        const [appSdk, authSdk, dbSdk] = await Promise.all([
          import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')
        ]);
        const app = appSdk.getApps().find(a => a.name === 'paragraph-comments')
          || appSdk.initializeApp(config.firebase, 'paragraph-comments');
        const auth = authSdk.getAuth(app), db = dbSdk.getFirestore(app);
        // Reuse the anonymous identity so the author can delete their own comments.
        await auth.authStateReady();
        if (!auth.currentUser) await authSdk.signInAnonymously(auth);
        return { sdk: dbSdk, db, auth };
      })().catch(e => { service = null; throw e; });
    }
    return service;
  }
  function collectionFor(b, target) {
    return b.sdk.collection(b.db, 'works', work, 'chapters', String(target.chapter), 'paragraphs', target.id, 'comments');
  }
  function stop() {
    ++opening;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }
  function cleanup() {
    stop();
    setDock(false);
    active?.paragraph.classList.remove('pc-selected');
    active = null;
  }
  close.onclick = () => dialog.close();
  docked.addEventListener('change', () => { if (dialog.open) dialog.close(); });
  // A docked panel is not modal, so the browser does not close it on Escape.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dialog.open && !dialog.matches(':modal') && !document.body.classList.contains('sheet-open')) dialog.close();
  });
  dialog.addEventListener('close', cleanup);
  dialog.addEventListener('click', e => { if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  } });
  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); else cleanup(); });
  text.addEventListener('input', () => { if (active) drafts.set(active.key, text.value); });
  retry.onclick = () => { if (active) return open(active); };

  function setCount(target, n) {
    const b = target.button, shown = n >= 50 ? '50+' : String(n);
    const label = n ? `${n >= 50 ? '50 ou mais' : n} ${n === 1 ? 'comentário' : 'comentários'}` : '';
    b.classList.toggle('pc-has', n > 0);
    b.querySelector('.pc-count').textContent = n ? shown : '';
    b.dataset.tip = n ? 'Ver ' + label : 'Comentar este parágrafo';
    b.setAttribute('aria-label', `Comentar o parágrafo ${target.ordinal}` + (n ? ` (${label})` : ''));
    counts.set(target.key, { n, at: Date.now() });
  }
  // Counts load one paragraph at a time, as the reader scrolls: each request is one database read.
  async function loadCount(target) {
    if (countsOff || !target.paragraph.isConnected) return;
    const f = config.firebase;
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(f.projectId)}/databases/(default)/documents/works/`
      + `${encodeURIComponent(work)}/chapters/${target.chapter}/paragraphs/${encodeURIComponent(target.id)}/comments`
      + `?pageSize=50&mask.fieldPaths=createdAt&key=${encodeURIComponent(f.apiKey)}`;
    try {
      const r = await fetch(url);
      if (!r.ok) { countsOff = true; return; } // Quota or rules: stop asking, the panel still works.
      setCount(target, ((await r.json()).documents || []).length);
    } catch (_) {}
  }
  function pump() {
    while (running < 4 && queue.length) {
      running++;
      loadCount(queue.shift()).finally(() => { running--; pump(); });
    }
  }
  function watch(root, list) {
    watcher?.disconnect(); sizer?.disconnect(); queue.length = 0;
    // The button sits in the page margin when the margin is wide enough; otherwise it keeps its gutter.
    const first = list.find(t => t.paragraph.classList.contains('pc-paragraph'))?.paragraph;
    if (first && window.ResizeObserver) {
      sizer = new ResizeObserver(() => {
        const r = first.getBoundingClientRect();
        const edge = document.documentElement.clientWidth - parseFloat(getComputedStyle(document.body).paddingRight); // minus a docked panel
        if (r.width) keepPlace(() => root.classList.toggle('pc-float', edge - r.right >= 64));
      });
      sizer.observe(root); sizer.observe(document.documentElement);
    }
    if (!configured() || !window.IntersectionObserver) return;
    watcher = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { watcher.unobserve(e.target); queue.push(targets.get(e.target)); }
      pump();
    }, { rootMargin: '600px 0px' });
    for (const t of list) {
      const known = counts.get(t.key);
      if (known && Date.now() - known.at < 300000) setCount(t, known.n);
      else { targets.set(t.paragraph, t); watcher.observe(t.paragraph); }
    }
  }
  function draw(snapshot, b, target, version) {
    list.replaceChildren();
    const docs = snapshot.docs;
    if (!docs.length) status.textContent = snapshot.metadata.fromCache
      ? 'Conectando ao banco de comentários…' : 'Ainda não há comentários. Seja a primeira pessoa a comentar!';
    else status.textContent = `${docs.length === 50 ? 'Últimos 50 comentários' : docs.length + (docs.length === 1 ? ' comentário' : ' comentários')}${snapshot.metadata.fromCache ? ' · aguardando conexão' : ''}`;
    if (docs.length || !snapshot.metadata.fromCache) setCount(target, docs.length); // An empty cache is not a real zero.
    for (const doc of [...docs].reverse()) {
      const data = doc.data(), item = el('article', 'pc-item');
      const meta = el('div', 'pc-meta');
      meta.append(el('strong', '', data.authorName));
      const time = el('time');
      const date = data.createdAt?.toDate?.();
      time.textContent = date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date) : 'Enviando…';
      if (date) time.dateTime = date.toISOString();
      meta.append(time);
      item.append(meta, el('p', 'pc-content', data.text)); // Always plain text: no comment HTML.
      if (data.uid === b.auth.currentUser?.uid && !doc.metadata.hasPendingWrites) {
        const remove = el('button', 'pc-delete', 'Excluir'); remove.type = 'button';
        let armed = false;
        remove.onclick = async () => {
          if (!armed) { armed = true; remove.textContent = 'Confirmar exclusão'; return; }
          remove.disabled = true;
          try { await b.sdk.deleteDoc(doc.ref); }
          catch (e) { if (version === opening) { error.textContent = message(e); remove.disabled = false; } }
        };
        item.append(remove);
      }
      list.append(item);
    }
  }
  async function open(target) {
    stop();
    active?.paragraph.classList.remove('pc-selected');
    active = target;
    const version = opening;
    target.paragraph.classList.add('pc-selected');
    quote.textContent = target.quote;
    title.textContent = `Capítulo ${target.chapter} · Parágrafo ${target.ordinal}`;
    list.replaceChildren(); error.textContent = ''; retry.hidden = true;
    text.value = drafts.get(target.key) || '';
    ready = false; send.disabled = true;
    status.textContent = 'Carregando comentários…';
    if (!dialog.open) {
      if (docked.matches) { setDock(true); dialog.show(); } else dialog.showModal();
      dialog.focus({ preventScroll: true });
    }
    if (!configured()) {
      status.textContent = 'Os comentários ainda não foram ativados neste site.';
      hint.textContent = 'Para ativar, a autora precisa preencher firebase-config.js e publicar as regras do Firestore conforme COMENTARIOS.md.';
      return;
    }
    hint.textContent = 'Seu nome e comentário ficarão públicos. Não precisa criar uma conta.';
    try {
      const b = await backend();
      if (version !== opening || !dialog.open) return;
      ready = true; send.disabled = sending;
      const q = b.sdk.query(collectionFor(b, target), b.sdk.orderBy('createdAt', 'desc'), b.sdk.limit(50));
      unsubscribe = b.sdk.onSnapshot(q, { includeMetadataChanges: true }, snap => {
        if (version === opening) draw(snap, b, target, version);
      }, e => {
        if (version !== opening) return;
        ready = false; status.textContent = message(e); retry.hidden = false; send.disabled = true;
      });
    } catch (e) {
      if (version !== opening) return;
      status.textContent = message(e); retry.hidden = false;
    }
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending || send.disabled || !active) return;
    const authorName = name.value.trim(), content = text.value.trim();
    if (!authorName || !content) { error.textContent = 'Preencha seu nome e escreva um comentário.'; return; }
    if (authorName.length > 60 || content.length > 2000) { error.textContent = 'Use até 60 caracteres no nome e 2.000 no comentário.'; return; }
    const target = active, version = opening;
    sending = true; send.disabled = true; text.disabled = true; name.disabled = true;
    send.textContent = 'Enviando…'; error.textContent = '';
    try {
      const b = await backend();
      await b.sdk.addDoc(collectionFor(b, target), {
        authorName, text: content, uid: b.auth.currentUser.uid, createdAt: b.sdk.serverTimestamp()
      });
      drafts.delete(target.key);
      try { localStorage.setItem('apol_comment_name', authorName); } catch (_) {}
      if (version === opening) { text.value = ''; error.textContent = ''; status.textContent = 'Comentário enviado!'; }
    } catch (e) {
      if (version === opening) error.textContent = message(e);
    } finally {
      sending = false; text.disabled = false; name.disabled = false;
      send.textContent = 'Enviar comentário';
      send.disabled = !ready || !dialog.open;
    }
  });
  window.ParagraphComments = {
    mount(root, chapter) {
      const ps = window.Paragraphs.assign(root), list = [];
      ps.forEach((paragraph, i) => {
        if (paragraph.querySelector(':scope > .pc-trigger')) return;
        const id = paragraph.dataset.paragraphId;
        const quote = paragraph.textContent.trim();
        const button = el('button', 'pc-trigger'); button.type = 'button';
        button.innerHTML = ICON; button.append(el('span', 'pc-count'));
        button.dataset.tip = 'Comentar este parágrafo'; // Shown by CSS as the tooltip.
        button.setAttribute('aria-label', `Comentar o parágrafo ${i + 1}`);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-controls', dialog.id);
        const target = { chapter, id, quote, paragraph, button, ordinal: i + 1, key: chapter + '/' + id };
        button.onclick = () => open(target);
        // Mouse only: a tap on a phone is often a scroll or a text selection, so touch keeps the button.
        paragraph.addEventListener('click', e => {
          if (!hoverable.matches || e.target.closest('a, button, summary, input, textarea, select')) return;
          if (!getSelection().isCollapsed) return; // The reader selected text.
          open(target);
        });
        paragraph.classList.add(paragraph.closest('.widget') ? 'pc-widget-paragraph' : 'pc-paragraph');
        paragraph.append(button);
        list.push(target);
      });
      if (list.length) watch(root, list);
    }
  };
})();
