// POST /api/publish: saves one chapter (33 and later) to extra.js in the GitHub repo.
// One commit holds the chapter and its pictures, so Vercel deploys once.
// Needs ADMIN_PASSWORD and GITHUB_TOKEN (fine-grained, this repo, Contents: read and write).
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');

const BASE = 32;                   // chapters 1 to 32 live in data.js
const MAX_BODY = 600000;           // characters
const MAX_IMAGES = 3000000;        // bytes for all pictures of one request
const REPO = process.env.GITHUB_REPO || `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`;
const BRANCH = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF;

// Same idea as AO3: structure and classes stay, scripts, styles and event handlers go.
const clean = html => sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(
    ['img', 'details', 'summary', 'figure', 'figcaption', 'center', 'del', 'ins', 'big', 'h1', 'h2']),
  allowedAttributes: {
    '*': ['class', 'title', 'dir', 'lang'],
    a: ['href', 'name', 'rel', 'target'],
    img: ['src', 'alt', 'width', 'height'],
    details: ['open'], ol: ['start'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
});
const count = (s, re) => (s.match(re) || []).length;

const key = crypto.randomBytes(32);
const mac = s => crypto.createHmac('sha256', key).update(String(s)).digest();
const passwordOk = p => !!process.env.ADMIN_PASSWORD && crypto.timingSafeEqual(mac(p), mac(process.env.ADMIN_PASSWORD));

function imageKind(buf) {
  const hex = buf.subarray(0, 4).toString('hex');
  if (hex.startsWith('ffd8ff')) return 'jpg';
  if (hex === '89504e47') return 'png';
  if (hex === '47494638') return 'gif';
  if (hex === '52494646' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return '';
}

async function gh(path, body, method) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: path.startsWith('contents/') ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'fic-post-area',
    },
    body: body && JSON.stringify(body),
  });
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
  return path.startsWith('contents/') ? r.text() : r.json();
}

// Commits made through the API carry the account's primary email unless an author is given.
// Use the account's GitHub no-reply address, so no personal email shows in the history.
async function author() {
  try {
    const r = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'fic-post-area' },
    });
    const u = r.ok ? await r.json() : null;
    return u && u.id && u.login ? { name: u.login, email: `${u.id}+${u.login}@users.noreply.github.com` } : null;
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  const fail = (code, error) => res.status(code).json({ error });
  if (req.method !== 'POST') return fail(405, 'Use POST.');
  let input = req.body;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch (e) { input = null; } }
  if (!input || typeof input !== 'object') return fail(400, 'Pedido inválido.');
  if (!passwordOk(input.password)) return fail(401, 'Senha incorreta.');
  if (!process.env.GITHUB_TOKEN || !BRANCH || REPO.includes('undefined')) return fail(500, 'O servidor não está configurado.');

  const n = input.n, raw = input.body;
  const title = String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);  // plain text: the reader shows it as text
  if (!Number.isInteger(n) || n <= BASE) return fail(400, `O capítulo precisa ser ${BASE + 1} ou maior.`);
  if (typeof raw !== 'string' || !raw.trim()) return fail(400, 'O capítulo está vazio.');
  if (raw.length > MAX_BODY) return fail(400, 'O capítulo é grande demais.');

  const images = [];
  let size = 0;
  for (const im of Array.isArray(input.images) ? input.images : []) {
    const m = /^[0-9a-f]{16}\.(jpg|png|gif|webp)$/.exec(String(im && im.name));
    const buf = Buffer.from(String(im && im.data), 'base64');
    if (!m || imageKind(buf) !== m[1]) return fail(400, 'Imagem inválida.');
    size += buf.length;
    if (size > MAX_IMAGES) return fail(400, 'As imagens passam de 3 MB.');
    images.push({ name: m[0], data: buf.toString('base64') });
  }

  const body = clean(raw);
  if (!body.trim()) return fail(400, 'O capítulo está vazio.');
  const removed = count(body, /<[a-z]/gi) < count(raw, /<[a-z]/gi) || count(body, /\s[a-z-]+=/gi) < count(raw, /\s[a-z-]+=/gi);

  try {
    const head = (await gh(`git/ref/heads/${BRANCH}`)).object.sha;
    const baseTree = (await gh(`git/commits/${head}`)).tree.sha;
    let list = [];
    try {
      const text = await gh(`contents/extra.js?ref=${head}`);
      list = JSON.parse(text.replace(/^window\.FIC_EXTRA=/, '').replace(/;\s*$/, ''));
    } catch (e) { if (e.status !== 404) throw e; }

    const old = list.find(c => c.n === n);
    const next = BASE + list.length + 1;
    if (!old && n !== next) return fail(400, `O próximo capítulo é o ${next}.`);
    const entry = old || { n, date: new Date().toISOString().slice(0, 10) };
    if (title) entry.title = title; else delete entry.title;
    entry.body = body;
    if (!old) list.push(entry);
    list.sort((a, b) => a.n - b.n);

    const tree = [{ path: 'extra.js', mode: '100644', type: 'blob', content: 'window.FIC_EXTRA=' + JSON.stringify(list) + ';\n' }];
    for (const im of images) {
      const blob = await gh('git/blobs', { content: im.data, encoding: 'base64' });
      tree.push({ path: `img/${im.name}`, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const newTree = await gh('git/trees', { base_tree: baseTree, tree });
    const who = await author();
    if (!who) return fail(502, 'Não foi possível salvar no GitHub.');  // never fall back to the primary email
    const commit = await gh('git/commits', {
      message: `${old ? 'fix: update' : 'feat: publish'} chapter ${n}`, tree: newTree.sha, parents: [head], author: who,
    });
    await gh(`git/refs/heads/${BRANCH}`, { sha: commit.sha }, 'PATCH');
    return res.status(200).json({ ok: true, n, title, body, removed, updated: !!old });
  } catch (e) {
    console.error('publish failed:', e.message);
    if (e.status === 422 || e.status === 409) return fail(409, 'Outra publicação aconteceu ao mesmo tempo. Tente de novo.');
    return fail(502, 'Não foi possível salvar no GitHub.');
  }
};
