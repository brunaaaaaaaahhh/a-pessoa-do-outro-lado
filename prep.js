// Shapes a chapter posted from /admin like the imported ones: loose text becomes
// paragraphs (blank line = new paragraph, as on AO3), each top-level widget goes in
// .widget, a short bold-only paragraph is a date line, a picture-only paragraph is a figure.
window.prepChapter = function (html) {
  const BLOCK = /^(DIV|P|H[1-6]|BLOCKQUOTE|UL|OL|HR|TABLE|FIGURE|DETAILS|CENTER|PRE|DL)$/;
  const t = document.createElement('template');
  t.innerHTML = html;
  const out = document.createElement('div');
  let p = null;

  const put = el => {
    if (el.tagName === 'P') {
      const only = el.children.length === 1 && el.firstElementChild, text = el.textContent.trim();
      if (only && only.tagName === 'IMG' && !text) {
        const f = document.createElement('figure'); f.className = 'pic'; f.appendChild(only); el = f;
      } else if (only && /^(STRONG|B)$/.test(only.tagName) && text === only.textContent.trim() && text.length <= 80) {
        el.classList.add('dateline');
      }
    } else if (el.tagName === 'DIV' && !el.classList.contains('widget')) {
      const w = document.createElement('div'); w.className = 'widget'; w.appendChild(el); el = w;
    }
    out.appendChild(el);
  };
  const flush = () => { if (p && (p.textContent.trim() || p.querySelector('img'))) put(p); p = null; };
  const add = n => { (p = p || document.createElement('p')).appendChild(n); };

  [...t.content.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      n.data.split(/\n[ \t]*\n\s*/).forEach((part, i) => {
        if (i) flush();
        part.split('\n').forEach((line, j) => {
          if (j && p) p.appendChild(document.createElement('br'));
          if (line.trim()) add(document.createTextNode(line));
        });
      });
    } else if (n.nodeType === 1) {
      if (BLOCK.test(n.tagName)) { flush(); put(n); } else add(n);
    }
  });
  flush();
  return { body: out.innerHTML, words: out.textContent.split(/\s+/).filter(Boolean).length };
};
