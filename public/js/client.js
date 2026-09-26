let CU = null; // usuário logado
let services = [], barbers = [], myAppointments = [];
let tab = 'agendar';
let bookStep = { serviceId: null, barberId: null, date: '', time: '' };

function getParam(name) { return new URLSearchParams(location.search).get(name); }

async function boot() {
  CU = await Api.me();
  if (!CU) { location.href = 'login.html' + location.search; return; }
  if (CU.role === 'admin') { location.href = 'admin.html'; return; }
  try {
    const [s, b, a] = await Promise.all([Api.get('/api/services'), Api.get('/api/barbers'), Api.get('/api/appointments')]);
    services = s.services; barbers = b.barbers; myAppointments = a.appointments;
  } catch (e) { showToast('Erro ao carregar dados: ' + e.message); }

  // Pré-seleciona serviço/barbeiro se o cliente veio das páginas de Serviços ou Equipe
  const svcParam = getParam('service'), brbParam = getParam('barber');
  if (svcParam && services.some(s => s.id === svcParam)) bookStep.serviceId = svcParam;
  if (brbParam && barbers.some(b => b.id === brbParam)) bookStep.barberId = brbParam;

  renderProfileHeader();
  renderTab();
}
boot();

function setTab(t) { tab = t; ['agendar','meus','perfil'].forEach(k => document.getElementById('tab-'+k).classList.toggle('active', k===t)); renderTab(); }

async function renderTab() {
  const box = document.getElementById('content');
  if (tab === 'agendar') box.innerHTML = renderBooking();
  else if (tab === 'meus') { box.innerHTML = '<p class="skeleton">Carregando agendamentos...</p>'; box.innerHTML = await renderMyAppointments(); }
  else if (tab === 'perfil') box.innerHTML = renderProfile();
}

// ---------- CABEÇALHO / RESUMO ----------
function renderProfileHeader() {
  const box = document.getElementById('profileHeader');
  const now = new Date();
  const next = myAppointments
    .filter(a => (a.status === 'pendente' || a.status === 'confirmado') && new Date(a.date + 'T' + a.time) > now)
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))[0];

  let html = `<h1 style="font-size:26px;margin:0 0 4px">Olá, ${esc(CU.name.split(' ')[0])} 👋</h1>
  <p class="muted" style="margin:0 0 20px">Bem-vindo à sua área na Barbearia Nobre.</p>`;

  if (next) {
    const svc = services.find(s => s.id === next.serviceId);
    const brb = barbers.find(b => b.id === next.barberId);
    const info = brb ? barberInfo(brb.name) : null;
    html += `<div class="nextcard">
      ${info ? `<img src="${info.photo}" alt="${esc(brb.name)}">` : ''}
      <div>
        <div class="lbl">Seu próximo agendamento</div>
        <b>${esc(svc ? svc.name : '—')}</b> com ${esc(brb ? brb.name : '—')} · ${fmtDate(next.date)} às ${next.time}
        <span class="badge b-${next.status}" style="margin-left:8px">${next.status}</span>
      </div>
    </div>`;
  }
  box.innerHTML = html;
}

// ---------- AGENDAR ----------
function renderBooking() {
  let html = `<h3 style="margin-bottom:8px">1. Escolha o serviço</h3><div class="stepcard">`;
  html += services.map(s => {
    const info = serviceInfo(s.name);
    return `<div class="pick ${bookStep.serviceId===s.id?'sel':''}" onclick="pickService('${s.id}')">
      <div class="pickimg"><img src="${info.image}" alt=""><div><b>${esc(s.name)}</b><span>${s.duration} min · ${money(s.price)}</span></div></div>
    </div>`;
  }).join('');
  html += `</div>`;

  if (bookStep.serviceId) {
    html += `<h3 style="margin-bottom:8px">2. Escolha o barbeiro</h3><div class="stepcard">`;
    html += barbers.map(b => {
      const info = barberInfo(b.name);
      return `<div class="pick ${bookStep.barberId===b.id?'sel':''}" onclick="pickBarber('${b.id}')">
        <div class="pickimg"><img src="${info.photo}" alt=""><div><b>${esc(b.name)}</b><span>${info.specialty}</span></div></div>
      </div>`;
    }).join('');
    html += `</div>`;
  }
  if (bookStep.serviceId && bookStep.barberId) {
    html += `<h3 style="margin-bottom:8px">3. Escolha a data</h3>
    <div class="field" style="max-width:220px"><input type="date" id="dateInput" min="${todayISO()}" value="${bookStep.date}" onchange="pickDate(this.value)"></div>`;
  }
  if (bookStep.serviceId && bookStep.barberId && bookStep.date) {
    html += `<h3 style="margin-bottom:8px">4. Escolha o horário</h3><div id="slotsBox"><p class="skeleton">Carregando horários...</p></div>`;
  }
  html += `<div id="confirmBox"></div>`;
  return html;
}
function pickService(id) { bookStep.serviceId = id; bookStep.time=''; renderAndReflow(); }
function pickBarber(id) { bookStep.barberId = id; bookStep.time=''; renderAndReflow(); }
function pickDate(v) { bookStep.date = v; bookStep.time=''; renderAndReflow(); }
async function renderAndReflow() {
  document.getElementById('content').innerHTML = renderBooking();
  if (bookStep.serviceId && bookStep.barberId && bookStep.date) await loadSlots();
}
async function loadSlots() {
  const box = document.getElementById('slotsBox');
  try {
    const { slots } = await Api.get(`/api/availability?barberId=${bookStep.barberId}&date=${bookStep.date}&serviceId=${bookStep.serviceId}`);
    box.innerHTML = slots.length ? `<div class="slots">${slots.map(s => `<div class="slot ${bookStep.time===s?'sel':''}" onclick="pickTime('${s}')">${s}</div>`).join('')}</div>`
      : `<p class="muted">Nenhum horário disponível nesta data. Escolha outra data.</p>`;
  } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
function pickTime(t) {
  bookStep.time = t;
  document.querySelectorAll('.slot').forEach(el => el.classList.toggle('sel', el.textContent === t));
  const svc = services.find(s => s.id === bookStep.serviceId);
  const brb = barbers.find(b => b.id === bookStep.barberId);
  document.getElementById('confirmBox').innerHTML = `
    <div class="card" style="max-width:420px;margin-top:14px">
      <h3>Confirmar agendamento</h3>
      <p class="muted">${esc(svc.name)} com ${esc(brb.name)}<br>${fmtDate(bookStep.date)} às ${t} · ${money(svc.price)}</p>
      <button class="btn solid" onclick="confirmBooking()">Confirmar Agendamento</button>
      <div id="confirmMsg"></div>
    </div>`;
}
async function confirmBooking() {
  try {
    await Api.post('/api/appointments', { barberId: bookStep.barberId, serviceId: bookStep.serviceId, date: bookStep.date, time: bookStep.time });
    bookStep = { serviceId: null, barberId: null, date: '', time: '' };
    showToast('Agendamento solicitado! Aguarde a confirmação do barbeiro.');
    const { appointments } = await Api.get('/api/appointments');
    myAppointments = appointments;
    renderProfileHeader();
    setTab('meus');
  } catch (e) {
    document.getElementById('confirmMsg').innerHTML = `<p class="err">${esc(e.message)}</p>`;
    if (bookStep.date) loadSlots();
  }
}

// ---------- MEUS AGENDAMENTOS ----------
async function renderMyAppointments() {
  try {
    const { appointments } = await Api.get('/api/appointments');
    myAppointments = appointments;
    if (!appointments.length) return `<div class="emptybox">Você ainda não tem agendamentos. Vá até a aba "Agendar" para marcar seu horário.</div>`;

    const now = new Date();
    const upcoming = appointments.filter(a => (a.status==='pendente'||a.status==='confirmado') && new Date(a.date+'T'+a.time) > now).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    const past = appointments.filter(a => !upcoming.includes(a)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));

    function rows(list) {
      return list.map(a => {
        const svc = services.find(s => s.id === a.serviceId);
        const brb = barbers.find(b => b.id === a.barberId);
        const canCancel = (a.status === 'pendente' || a.status === 'confirmado') && new Date(a.date + 'T' + a.time) > new Date();
        return `<tr><td>${fmtDate(a.date)}</td><td>${a.time}</td><td>${esc(svc?svc.name:'—')}</td><td>${esc(brb?brb.name:'—')}</td>
        <td><span class="badge b-${a.status}">${a.status}</span></td>
        <td>${canCancel ? `<button class="btn small danger" onclick="cancelAppt('${a.id}')">Cancelar</button>` : ''}</td></tr>`;
      }).join('');
    }
    let html = '';
    html += `<h3 style="margin-top:0">Próximos (${upcoming.length})</h3>`;
    html += upcoming.length ? `<div class="tablewrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th></th></tr></thead><tbody>${rows(upcoming)}</tbody></table></div>` : `<div class="emptybox">Nenhum agendamento futuro.</div>`;
    html += `<h3>Histórico (${past.length})</h3>`;
    html += past.length ? `<div class="tablewrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th></th></tr></thead><tbody>${rows(past)}</tbody></table></div>` : `<div class="emptybox">Nenhum agendamento anterior ainda.</div>`;
    return html;
  } catch (e) { return `<p class="err">${esc(e.message)}</p>`; }
}
async function cancelAppt(id) {
  if (!confirm('Cancelar este agendamento?')) return;
  try {
    await Api.put(`/api/appointments/${id}/status`, { status: 'cancelado' });
    showToast('Agendamento cancelado.');
    document.getElementById('content').innerHTML = await renderMyAppointments();
    renderProfileHeader();
  } catch (e) { showToast(e.message); }
}

// ---------- PERFIL ----------
function renderProfile() {
  const total = myAppointments.length;
  const completed = myAppointments.filter(a => a.status === 'concluido').length;
  const cancelled = myAppointments.filter(a => a.status === 'cancelado').length;
  const barberCount = {};
  myAppointments.forEach(a => { barberCount[a.barberId] = (barberCount[a.barberId]||0)+1; });
  const favId = Object.keys(barberCount).sort((a,b)=>barberCount[b]-barberCount[a])[0];
  const favBarber = favId ? barbers.find(b => b.id === favId) : null;
  const memberSince = new Date(CU.created_at || Date.now()).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return `
  <div class="profileheader">
    <div class="avatar">${esc(CU.name.charAt(0).toUpperCase())}</div>
    <div><h2 style="margin:0 0 4px">${esc(CU.name)}</h2><span class="muted">Cliente desde ${memberSince}</span></div>
  </div>
  <div class="statgrid">
    <div class="statcard"><b>${total}</b><span>Agendamentos no total</span></div>
    <div class="statcard"><b>${completed}</b><span>Atendimentos concluídos</span></div>
    <div class="statcard"><b>${cancelled}</b><span>Cancelados</span></div>
    <div class="statcard"><b style="font-size:16px">${favBarber ? esc(favBarber.name) : '—'}</b><span>Barbeiro favorito</span></div>
  </div>
  <div class="card" style="max-width:420px">
    <h3>Dados pessoais</h3>
    <div class="field"><label>Nome</label><input id="p_name" value="${esc(CU.name)}"></div>
    <div class="field"><label>E-mail</label><input value="${esc(CU.email)}" disabled></div>
    <div class="field"><label>Telefone</label><input id="p_phone" value="${esc(CU.phone)}"></div>
    <button class="btn solid" onclick="saveProfile()">Salvar alterações</button>
    <div id="p_msg"></div>
  </div>`;
}
async function saveProfile() {
  const name = document.getElementById('p_name').value;
  const phone = document.getElementById('p_phone').value;
  const msg = document.getElementById('p_msg');
  try {
    const { user } = await Api.put('/api/me', { name, phone });
    CU = { ...CU, ...user };
    msg.innerHTML = '<p class="ok">Perfil atualizado com sucesso.</p>';
    showToast('Perfil atualizado.');
    mountNav();
    renderProfileHeader();
  } catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
