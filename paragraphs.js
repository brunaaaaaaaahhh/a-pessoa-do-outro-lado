// Shared by the reader and editor. Never replace an existing paragraph ID.
(() => {
  function eligible(root) {
    return [...root.querySelectorAll(':scope > p, :scope > blockquote > p, .msg-text > p, .msn-chat-msg-block > p, .postcard-content p, .tw-tweet > p')]
      .filter(p => !p.matches('.dateline, .ask-user-header') && /[\p{L}\p{N}]/u.test(p.textContent));
  }
  function hash(text) {
    let a = 2166136261, b = 5381;
    for (const c of text.normalize('NFC')) {
      a = Math.imul(a ^ c.codePointAt(0), 16777619);
      b = Math.imul(b, 33) ^ c.codePointAt(0);
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  function assign(root) {
    const ps = eligible(root), used = new Set();
    // Reserve existing IDs before generating IDs for inserted paragraphs.
    for (const p of ps) {
      const id = p.dataset.paragraphId;
      if (id && /^[a-zA-Z0-9_-]{1,100}$/.test(id) && !used.has(id)) used.add(id);
      else delete p.dataset.paragraphId;
    }
    for (const p of ps) {
      if (p.dataset.paragraphId) continue;
      const base = 'p-' + hash(p.textContent.replace(/\s+/g, ' ').trim());
      let id = base, i = 1;
      while (used.has(id)) id = base + '-' + (++i);
      p.dataset.paragraphId = id;
      used.add(id);
    }
    return ps;
  }
  window.Paragraphs = { eligible, assign };
})();
