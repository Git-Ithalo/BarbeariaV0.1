// Preenche a área de autenticação da barra de navegação em todas as páginas públicas.
async function mountNav() {
  const box = document.getElementById('authNav');
  if (!box) return;
  const user = await Api.me();
  if (!user) {
    box.innerHTML = `<a href="login.html" class="btn small">Entrar</a><a href="cadastro.html" class="btn small solid">Cadastrar</a>`;
  } else if (user.role === 'admin') {
    box.innerHTML = `<a href="admin.html">Painel</a><span class="muted">Olá, ${esc(user.name.split(' ')[0])}</span><button class="btn small ghost" onclick="Api.logout()">Sair</button>`;
  } else {
    box.innerHTML = `<a href="app.html">Minha Área</a><span class="muted">Olá, ${esc(user.name.split(' ')[0])}</span><button class="btn small ghost" onclick="Api.logout()">Sair</button>`;
  }
}
mountNav();
