/**
 * scripts.js - Lógica Completa do App Cams Exercícios
 */

// ─── CONFIGURAÇÕES E CONSTANTES ───
const DAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAYS_FULL = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const PRESETS = [
    { name: "Quadríceps", icon: "🦵" },
    { name: "Panturrilha", icon: "🦶" },
    { name: "Glúteo", icon: "🍑" },
    { name: "Costas", icon: "🔙" },
    { name: "Bíceps", icon: "💪" },
    { name: "Escada", icon: "🏃‍♀️" },
];

const ACADEMIA = {
    lat: -3.756198,
    lng: -38.565039,
    raioMetros: 200
};

// ─── ESTADO GLOBAL ───
let activeIdx = 0; // 0=Seg, 6=Dom
let weekOffset = 0; // 0=semana atual
let activePeriod = 'week'; // para o relatório
let customFrom = null;
let customTo = null;
let dupWeekOffset = 0;
let dupSelectedKeys = new Set();

// ─── GESTÃO DE DADOS ───

function load() {
    try {
        const r = localStorage.getItem('treino_v3');
        return r ? JSON.parse(r) : { entries: {}, confirmed: {}, sessions: {}, creatine: {} };
    } catch (e) {
        return { entries: {}, confirmed: {}, sessions: {}, creatine: {} };
    }
}

async function save(data) {
    try {
        localStorage.setItem('treino_v3', JSON.stringify(data));
        // Sincroniza com Firebase se estiver pronto
        if (window._firebaseReady) {
            window._firebaseSkipSnapshot = true;
            const ref = window._firebaseDocRef("dados/treino_v3");
            await window._firebaseSetDoc(ref, { payload: JSON.stringify(data) }, { merge: true });
            setTimeout(() => { window._firebaseSkipSnapshot = false; }, 1000);
        }
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
}

function dateKey(date) {
    return date.toISOString().slice(0, 10);
}

// ─── LÓGICA DE DATAS ───

function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff + weekOffset * 7);
    mon.setHours(0, 0, 0, 0);
    return mon;
}

function getWeekDates() {
    const mon = getWeekStart();
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        return d;
    });
}

function todayWeekIdx() {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
}

// ─── RENDERIZAÇÃO PRINCIPAL ───

function renderMain() {
    updateDateBadge();
    renderTabs();
    renderList();
    renderOverview();
    renderStats();
    renderCheckinBar();
    renderCreatineBar();
    renderPresetChips();
    renderDupBar();
    renderConfirmBar();
}

function updateDateBadge() {
    document.getElementById('current-date').textContent =
        new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderTabs() {
    const nav = document.getElementById('week-nav');
    if (!nav) return;
    nav.innerHTML = '';

    const todayKey = dateKey(new Date());
    const dates = getWeekDates();
    const mon = dates[0];
    const sun = dates[6];

    const weekLabel = document.createElement('div');
    weekLabel.className = 'week-label';
    const monStr = `${mon.getDate()} ${MONTHS_PT[mon.getMonth()]}`;
    const sunStr = `${sun.getDate()} ${MONTHS_PT[sun.getMonth()]}`;

    weekLabel.innerHTML = `
    <button class="week-arrow" onclick="changeWeek(-1)">‹</button>
    <span class="week-range">
      ${weekOffset === 0 ? '<span class="week-badge">Esta semana</span>' : '<span class="week-badge past">Outra semana</span>'}
      ${monStr} – ${sunStr}
    </span>
    <button class="week-arrow" onclick="changeWeek(1)">›</button>
    ${weekOffset !== 0 ? `<button class="week-today-btn" onclick="goToToday()">Hoje</button>` : ''}
  `;
    nav.appendChild(weekLabel);

    const tabsRow = document.createElement('div');
    tabsRow.className = 'tabs-row';

    dates.forEach((date, i) => {
        const key = dateKey(date);
        const data = load();
        const n = (data.entries[key] || []).length;
        const confirmed = !!(data.confirmed && data.confirmed[key]);

        const btn = document.createElement('button');
        btn.className = 'day-tab' + (i === activeIdx ? ' active' : '') + (key === todayKey ? ' today' : '');
        btn.innerHTML = `
      ${DAYS_SHORT[i]}
      <span style="font-size:0.65rem">${date.getDate()}/${MONTHS_PT[date.getMonth()]}</span>
      ${confirmed ? '<span class="tab-confirmed">✓</span>' : `<span class="ex-count">${n}</span>`}
    `;
        btn.onclick = () => { activeIdx = i; renderMain(); };
        tabsRow.appendChild(btn);
    });
    nav.appendChild(tabsRow);
}

function renderList() {
    const dates = getWeekDates();
    const key = dateKey(dates[activeIdx]);
    const data = load();
    const items = data.entries[key] || [];
    const list = document.getElementById('ex-list');

    document.getElementById('active-day-name').textContent = DAYS_FULL[activeIdx];
    document.getElementById('active-day-date').textContent = dates[activeIdx].toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    if (items.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="empty-icon">🌸</span>Nenhum exercício para hoje.</div>`;
        return;
    }

    list.innerHTML = '';
    items.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'ex-item' + (ex.done ? ' done' : '');
        div.innerHTML = `
      <div class="ex-check ${ex.done ? 'checked' : ''}" onclick="toggleEx('${key}', ${idx})"></div>
      <div class="ex-info">
        <div class="ex-name">${ex.name}</div>
        ${ex.time ? `<div class="ex-time">🕒 ${ex.time}</div>` : ''}
      </div>
      <button class="btn-del" onclick="deleteEx('${key}', ${idx})">✕</button>
    `;
        list.appendChild(div);
    });
}

// ─── AÇÕES DE EXERCÍCIO ───

function addExercise() {
    const input = document.getElementById('ex-input');
    const time = document.getElementById('ex-time');
    if (!input.value.trim()) return;

    const key = dateKey(getWeekDates()[activeIdx]);
    const data = load();
    if (!data.entries[key]) data.entries[key] = [];
    
    data.entries[key].push({
        id: Date.now(),
        name: input.value.trim(),
        time: time.value,
        done: false
    });

    save(data);
    input.value = '';
    renderMain();
    haptic('light');
}

function toggleEx(key, idx) {
    const data = load();
    data.entries[key][idx].done = !data.entries[key][idx].done;
    save(data);
    renderMain();
    haptic('light');
}

function deleteEx(key, idx) {
    const data = load();
    data.entries[key].splice(idx, 1);
    save(data);
    renderMain();
}

// ─── CREATINA ───

function renderCreatineBar() {
    const key = dateKey(getWeekDates()[activeIdx]);
    const data = load();
    const taken = !!(data.creatine && data.creatine[key]);
    const container = document.getElementById('creatine-bar');
    if (!container) return;

    container.innerHTML = `
    <div class="creatine-bar ${taken ? 'taken' : ''}">
      <div class="creatine-icon">${taken ? '🥤' : '🥛'}</div>
      <div class="creatine-info">
        <div class="creatine-title">Creatina</div>
        <div class="creatine-status">${taken ? 'Tomada ✓' : 'Ainda não tomou'}</div>
      </div>
      <button class="btn-creatine ${taken ? 'done' : ''}" onclick="toggleCreatine('${key}')">
        ${taken ? 'Desmarcar' : 'Check-in'}
      </button>
    </div>
  `;
}

function toggleCreatine(key) {
    const data = load();
    if (!data.creatine) data.creatine = {};
    if (data.creatine[key]) delete data.creatine[key];
    else data.creatine[key] = true;
    save(data);
    renderMain();
    haptic('success');
}

// ─── CHECK-IN ACADEMIA ───

function renderCheckinBar() {
    const key = dateKey(getWeekDates()[activeIdx]);
    const data = load();
    const sess = (data.sessions && data.sessions[key]) || { checkin: null, checkout: null };
    const bar = document.getElementById('checkin-bar');
    if (!bar) return;

    if (!sess.checkin) {
        bar.innerHTML = `<button class="btn-checkin" onclick="doCheckin('${key}')">📍 Check-in Academia</button>`;
    } else if (!sess.checkout) {
        bar.innerHTML = `<button class="btn-checkin btn-checkout" onclick="doCheckout('${key}')">🏁 Fim de Treino</button>`;
    } else {
        const start = new Date(sess.checkin);
        const end = new Date(sess.checkout);
        const diff = Math.round((end - start) / 60000);
        bar.innerHTML = `<div class="checkin-done">✨ Treino de ${diff}min concluído!</div>`;
    }
}

function doCheckin(key) {
    const data = load();
    if (!data.sessions) data.sessions = {};
    data.sessions[key] = { checkin: new Date().toISOString(), checkout: null };
    save(data);
    renderMain();
}

function doCheckout(key) {
    const data = load();
    data.sessions[key].checkout = new Date().toISOString();
    save(data);
    renderMain();
    haptic('success');
}

// ─── PRESETS ───

function renderPresetChips() {
    const container = document.getElementById('presets-chips');
    if (!container) return;
    container.innerHTML = '';
    PRESETS.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'preset-chip';
        btn.innerHTML = `<span>${p.icon}</span> ${p.name}`;
        btn.onclick = () => {
            document.getElementById('ex-input').value = p.name;
            addExercise();
        };
        container.appendChild(btn);
    });
}

// ─── RELATÓRIOS E STATS ───

function renderStats() {
    const data = load();
    const dates = getWeekDates();
    const key = dateKey(dates[activeIdx]);
    const todayEx = data.entries[key] || [];
    const done = todayEx.filter(e => e.done).length;
    const pct = todayEx.length ? Math.round((done / todayEx.length) * 100) : 0;

    const grid = document.getElementById('stats-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="stat-card s1"><div class="stat-num">${todayEx.length}</div><div class="stat-label">Total</div></div>
            <div class="stat-card s2"><div class="stat-num s2">${done}</div><div class="stat-label">Feitos</div></div>
        `;
    }

    const prog = document.getElementById('progress-wrap');
    if (prog) {
        prog.innerHTML = `
            <div class="progress-label"><span>Progresso</span> <span>${pct}%</span></div>
            <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
        `;
    }
}

function renderOverview() {
    const grid = document.getElementById('overview-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const dates = getWeekDates();
    const data = load();

    DAYS_SHORT.forEach((day, i) => {
        const key = dateKey(dates[i]);
        const n = (data.entries[key] || []).length;
        const div = document.createElement('div');
        div.className = 'ov-day' + (i === activeIdx ? ' active' : '');
        div.innerHTML = `<span class="ov-label">${day}</span><div class="ov-bar-wrap"><div class="ov-bar" style="height:${n * 10}%"></div></div>`;
        grid.appendChild(div);
    });
}

// ─── AUXILIARES ───

function changeWeek(dir) {
    weekOffset += dir;
    renderMain();
}

function goToToday() {
    weekOffset = 0;
    const day = new Date().getDay();
    activeIdx = (day === 0) ? 6 : day - 1;
    renderMain();
}

function haptic(type) {
    if (navigator.vibrate) {
        const patterns = { light: 10, success: [10, 50, 10] };
        navigator.vibrate(patterns[type] || 10);
    }
}

// ─── INITIALIZATION ───

function init() {
    // Configura o dia inicial
    const day = new Date().getDay();
    activeIdx = (day === 0) ? 6 : day - 1;

    // Escuta evento do Firebase para atualizar interface
    window.addEventListener("firebase-ready", () => {
        console.log("Firebase conectado, atualizando...");
        renderMain();
    });

    renderMain();

    // Splash Screen timeout
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.classList.add('hide');
    }, 2800);
}

// Expõe funções para o HTML
window.openReport = () => document.getElementById('overlay').classList.add('open');
window.closeReportBtn = () => document.getElementById('overlay').classList.remove('open');
window.changeWeek = changeWeek;
window.goToToday = goToToday;
window.addExercise = addExercise;
window.toggleEx = toggleEx;
window.deleteEx = deleteEx;
window.toggleCreatine = toggleCreatine;
window.doCheckin = doCheckin;
window.doCheckout = doCheckout;

window.onload = init;
