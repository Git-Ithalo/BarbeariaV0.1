// Wrapper simples para chamadas à API, incluindo o token de sessão automaticamente.
const Api = {
  token() { return localStorage.getItem('bb_token'); },
  setToken(t) { if (t) localStorage.setItem('bb_token', t); else localStorage.removeItem('bb_token'); },

  async req(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = this.token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await resp.json(); } catch (e) {}
    if (!resp.ok) throw new Error(data.error || 'Erro inesperado (' + resp.status + ')');
    return data;
  },
  get(url) { return this.req('GET', url); },
  post(url, body) { return this.req('POST', url, body); },
  put(url, body) { return this.req('PUT', url, body); },
  del(url) { return this.req('DELETE', url); },

  async me() {
    if (!this.token()) return null;
    try { const d = await this.get('/api/me'); return d.user; } catch (e) { this.setToken(null); return null; }
  },
  logout() {
    this.post('/api/auth/logout', {}).catch(()=>{});
    this.setToken(null);
    location.href = 'index.html';
  }
};

function money(n) { return 'R$ ' + Number(n).toFixed(2).replace('.', ','); }
function fmtDate(d) { const [y, m, day] = d.split('-'); return day + '/' + m + '/' + y; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function showToast(msg) {
  let t = document.getElementById('toastbox');
  if (t) t.remove();
  t = document.createElement('div');
  t.id = 'toastbox'; t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
