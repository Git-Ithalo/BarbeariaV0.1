let CU = null;
let barbersCache = [], servicesCache = [];
let tab = 'dashboard';
let agendaMode = 'upcoming'; // 'upcoming' (todos os próximos dias) ou 'day' (um dia específico)
let agendaDate = todayISO();
let agendaBarber = 'all';
let agendaStatus = 'ativos'; // 'ativos' (oculta cancelados) ou 'todos'

async function boot() {
  CU = await Api.me();
  if (!CU) { location.href = 'login.html'; return; }
  if (CU.role !== 'admin') { location.href = 'app.html'; return; }
  const [b, s] = await Promise.all([Api.get('/api/barbers'), Api.get('/api/services')]);
  barbersCache = b.barbers; servicesCache = s.services;
  renderTab();
  setInterval(() => { if (tab === 'dashboard' || tab === 'agenda') renderTab(); }, 8000);
}
boot();

function setTab(t) { tab = t; ['dashboard','agenda','servicos','clientes'].forEach(k => document.getElementById('tab-'+k).classList.toggle('active', k===t)); renderTab(); }

function barberName(id) { const b = barbersCache.find(x => x.id === id); return b ? b.name : '—'; }
function serviceName(id) { const s = servicesCache.find(x => x.id === id); return s ? s.name : '—'; }

async function renderTab() {
  const box = document.getElementById('content');
  if (tab === 'dashboard') box.innerHTML = await renderDashboard();
  else if (tab === 'agenda') box.innerHTML = await renderAgenda();
  else if (tab === 'servicos') box.innerHTML = renderServices();
  else if (tab === 'clientes') box.innerHTML = await renderClients();
}

function apptTable(list, showActions) {
  return `<div class="tablewrap"><table><thead><tr><th>Hora</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Status</th>${showActions?'<th>Ações</th>':''}</tr></thead><tbody>
  ${list.map(a => `<tr><td>${a.time}</td><td>${esc(a.clientName||'—')}</td><td>${esc(serviceName(a.serviceId))}</td><td>${esc(barberName(a.barberId))}</td>
  <td><span class="badge b-${a.status}">${a.status}</span></td>
  ${showActions ? `<td style="white-space:nowrap">
    ${a.status==='pendente' ? `<button class="btn small" onclick="changeStatus('${a.id}','confirmado')">Confirmar</button> ` : ''}
    ${(a.status==='pendente'||a.status==='confirmado') ? `<button class="btn small solid" onclick="changeStatus('${a.id}','concluido')">Concluir</button> <button class="btn small danger" onclick="changeStatus('${a.id}','cancelado')">Cancelar</button>` : ''}
  </td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}
async function changeStatus(id, status) {
  try { await Api.put(`/api/appointments/${id}/status`, { status }); showToast('Agendamento atualizado.'); renderTab(); }
  catch (e) { showToast(e.message); }
}

// Anexa nome do cliente (a API só retorna clientId) buscando via /api/clients
let clientsIndex = null;
async function withClientNames(appointments) {
  if (!clientsIndex) {
    const { clients } = await Api.get('/api/clients');
    clientsIndex = {}; clients.forEach(c => clientsIndex[c.id] = c.name);
  }
  return appointments.map(a => ({ ...a, clientName: clientsIndex[a.clientId] }));
}

async function renderDashboard() {
  try {
    const [stats, todayResp] = await Promise.all([Api.get('/api/stats'), Api.get('/api/appointments?date=' + todayISO())]);
    const todays = await withClientNames(todayResp.appointments.filter(a => a.status !== 'cancelado').sort((a,b)=>a.time.localeCompare(b.time)));
    return `<div class="statgrid">
      <div class="statcard"><b>${stats.todayCount}</b><span>Agendamentos hoje</span></div>
      <div class="statcard"><b>${stats.pending}</b><span>Pendentes de confirmação</span></div>
      <div class="statcard"><b>${money(stats.revenue)}</b><span>Faturamento do mês (concluídos)</span></div>
      <div class="statcard"><b>${stats.clients}</b><span>Clientes cadastrados</span></div>
    </div>
    <h3>Agendamentos de hoje</h3>
    ${todays.length ? apptTable(todays, true) : '<div class="emptybox">Nenhum agendamento para hoje.</div>'}`;
  } catch (e) { return `<p class="err">${esc(e.message)}</p>`; }
}

function dateHeaderLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = todayISO();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const base = weekday.charAt(0).toUpperCase() + weekday.slice(1) + ', ' + fmtDate(dateStr);
  if (dateStr === today) return base + ' — Hoje';
  if (dateStr === tomorrowISO) return base + ' — Amanhã';
  return base;
}

async function renderAgenda() {
  let listHtml = '<p class="skeleton">Carregando...</p>';
  try {
    let url;
    if (agendaMode === 'day') url = `/api/appointments?date=${agendaDate}`;
    else url = `/api/appointments?from=${todayISO()}`;
    if (agendaBarber !== 'all') url += `&barberId=${agendaBarber}`;
    const { appointments } = await Api.get(url);
    let list = appointments;
    if (agendaStatus === 'ativos') list = list.filter(a => a.status !== 'cancelado');
    list = await withClientNames(list.sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)));

    if (!list.length) {
      listHtml = `<div class="emptybox">${agendaMode==='day' ? 'Nenhum agendamento nesta data.' : 'Nenhum agendamento futuro encontrado.'}</div>`;
    } else if (agendaMode === 'day') {
      listHtml = apptTable(list, true);
    } else {
      // Agrupa por data para não ficar uma lista bagunçada, mas mostra TODOS os próximos, sem exigir escolher um dia
      const groups = {};
      list.forEach(a => { (groups[a.date] = groups[a.date] || []).push(a); });
      listHtml = Object.keys(groups).sort().map(date => `
        <h3 style="margin:22px 0 8px;font-size:15px;color:var(--gold2)">${dateHeaderLabel(date)} <span class="muted" style="font-weight:400;font-size:13px">(${groups[date].length} agendamento${groups[date].length>1?'s':''})</span></h3>
        ${apptTable(groups[date], true)}
      `).join('');
      listHtml = `<p class="muted" style="margin-bottom:18px">Mostrando ${list.length} agendamento${list.length>1?'s':''} a partir de hoje, em ${Object.keys(groups).length} dia${Object.keys(groups).length>1?'s':''}.</p>` + listHtml;
    }
  } catch (e) { listHtml = `<p class="err">${esc(e.message)}</p>`; }

  return `<div class="row">
    <div class="field" style="margin:0"><select onchange="agendaMode=this.value;renderTab()">
      <option value="upcoming" ${agendaMode==='upcoming'?'selected':''}>Todos os próximos agendamentos</option>
      <option value="day" ${agendaMode==='day'?'selected':''}>Um dia específico</option>
    </select></div>
    ${agendaMode==='day' ? `<div class="field" style="margin:0"><input type="date" value="${agendaDate}" onchange="agendaDate=this.value;renderTab()"></div>` : ''}
    <div class="field" style="margin:0"><select onchange="agendaBarber=this.value;renderTab()">
      <option value="all">Todos os barbeiros</option>
      ${barbersCache.map(b => `<option value="${b.id}" ${agendaBarber===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}
    </select></div>
    <div class="field" style="margin:0"><select onchange="agendaStatus=this.value;renderTab()">
      <option value="ativos" ${agendaStatus==='ativos'?'selected':''}>Ocultar cancelados</option>
      <option value="todos" ${agendaStatus==='todos'?'selected':''}>Mostrar todos (inclusive cancelados)</option>
    </select></div>
  </div>${listHtml}`;
}

function renderServices() {
  return `<div class="card" style="max-width:560px;margin-bottom:24px">
    <h3>Novo serviço</h3>
    <div class="formgrid">
      <div class="field"><label>Nome</label><input id="s_name"></div>
      <div class="field"><label>Duração (min)</label><input id="s_dur" type="number" value="30"></div>
      <div class="field"><label>Preço (R$)</label><input id="s_price" type="number" step="0.01" value="0"></div>
      <button class="btn solid" onclick="submitNewService()">Adicionar</button>
    </div>
    <div id="s_msg"></div>
  </div>
  <div class="tablewrap"><table><thead><tr><th>Serviço</th><th>Duração</th><th>Preço</th><th></th></tr></thead><tbody>
  ${servicesCache.map(s => `<tr><td>${esc(s.name)}</td><td>${s.duration} min</td><td>${money(s.price)}</td>
  <td><button class="btn small ghost" onclick="editService('${s.id}')">Editar</button> <button class="btn small danger" onclick="removeService('${s.id}')">Remover</button></td></tr>`).join('')}
  </tbody></table></div>`;
}
async function submitNewService() {
  const name = document.getElementById('s_name').value;
  const duration = document.getElementById('s_dur').value;
  const price = document.getElementById('s_price').value;
  const msg = document.getElementById('s_msg');
  try {
    const { service } = await Api.post('/api/services', { name, duration, price });
    servicesCache.push(service);
    showToast('Serviço adicionado.');
    renderTab();
  } catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
async function editService(id) {
  const s = servicesCache.find(x => x.id === id);
  const name = prompt('Nome do serviço:', s.name); if (name === null) return;
  const duration = prompt('Duração (minutos):', s.duration); if (duration === null) return;
  const price = prompt('Preço (R$):', s.price); if (price === null) return;
  try {
    const { service } = await Api.put(`/api/services/${id}`, { name, duration, price });
    servicesCache = servicesCache.map(x => x.id === id ? service : x);
    showToast('Serviço atualizado.');
    renderTab();
  } catch (e) { showToast(e.message); }
}
async function removeService(id) {
  if (!confirm('Remover este serviço?')) return;
  try {
    await Api.del(`/api/services/${id}`);
    servicesCache = servicesCache.filter(x => x.id !== id);
    showToast('Serviço removido.');
    renderTab();
  } catch (e) { showToast(e.message); }
}

async function renderClients() {
  try {
    const { clients } = await Api.get('/api/clients');
    if (!clients.length) return '<div class="emptybox">Nenhum cliente cadastrado ainda.</div>';
    return `<div class="tablewrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Agendamentos</th><th>Última visita</th></tr></thead><tbody>
    ${clients.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td><td>${c.totalAppointments}</td><td>${c.lastVisit?fmtDate(c.lastVisit):'—'}</td></tr>`).join('')}
    </tbody></table></div>`;
  } catch (e) { return `<p class="err">${esc(e.message)}</p>`; }
}
