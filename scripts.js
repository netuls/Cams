/**
 * scripts.js - Cams Exercícios (Versão Corrigida para GitHub Pages)
 */

// --- VARIÁVEIS DE ESTADO ---
let activeIdx = 0; 
let weekOffset = 0;
const DAYS_FULL = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// --- CARREGAMENTO DE DADOS ---
function load() {
    try {
        const r = localStorage.getItem('treino_v3');
        return r ? JSON.parse(r) : {entries:{}, confirmed:{}, sessions:{}, creatine:{}};
    } catch (e) {
        return {entries:{}, confirmed:{}, sessions:{}, creatine:{}};
    }
}

function save(data) {
    localStorage.setItem('treino_v3', JSON.stringify(data));
    if (window._firebaseReady) {
        const ref = window._firebaseDocRef("dados/treino_v3");
        window._firebaseSetDoc(ref, { payload: JSON.stringify(data) }, { merge: true });
    }
}

function dateKey(date) {
    return date.toISOString().slice(0,10);
}

// --- LOGICA DE DATA ---
function getWeekDates() {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff + weekOffset * 7);
    mon.setHours(0,0,0,0);
    return Array.from({length:7}, (_,i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
}

// --- RENDERIZAÇÃO ---
function renderMain() {
    try {
        const dates = getWeekDates();
        const currentKey = dateKey(dates[activeIdx]);
        const data = load();

        if(document.getElementById('active-day-name')) {
            document.getElementById('active-day-name').textContent = DAYS_FULL[activeIdx];
            document.getElementById('active-day-date').textContent = dates[activeIdx].toLocaleDateString('pt-BR', {day:'numeric', month:'long'});
        }

        renderList(currentKey, data);
        renderCreatineBar(currentKey, data);
    } catch (e) {
        console.warn("Aguardando carregamento da estrutura...");
    }
}

function renderList(key, data) {
    const list = document.getElementById('ex-list');
    if(!list) return;
    const items = data.entries[key] || [];
    list.innerHTML = items.length ? '' : '<div class="empty-state">Nenhum exercício hoje 🌸</div>';
    
    items.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = `ex-item ${ex.done ? 'done' : ''}`;
        div.innerHTML = `
            <div class="ex-check ${ex.done ? 'checked' : ''}" onclick="toggleEx('${key}', ${idx})"></div>
            <div class="ex-info"><div class="ex-name">${ex.name}</div></div>
            <button class="btn-del" onclick="deleteEx('${key}', ${idx})">✕</button>
        `;
        list.appendChild(div);
    });
}

function renderCreatineBar(key, data) {
    const bar = document.getElementById('creatine-bar');
    if(!bar) return;
    const taken = !!(data.creatine && data.creatine[key]);
    bar.innerHTML = `
        <div class="creatine-bar ${taken ? 'taken' : ''}">
            <div class="creatine-info">Creatina: <strong>${taken ? 'Tomada ✓' : 'Pendente'}</strong></div>
            <button class="btn-creatine ${taken ? 'done' : ''}" onclick="toggleCreatine('${key}')">
                ${taken ? 'Desmarcar' : 'Check-in'}
            </button>
        </div>
    `;
}

// --- FUNÇÕES GLOBAIS (Atribuídas ao window para o HTML encontrar) ---
window.toggleEx = function(key, idx) {
    const data = load();
    data.entries[key][idx].done = !data.entries[key][idx].done;
    save(data);
    renderMain();
};

window.deleteEx = function(key, idx) {
    const data = load();
    data.entries[key].splice(idx, 1);
    save(data);
    renderMain();
};

window.toggleCreatine = function(key) {
    const data = load();
    if (!data.creatine) data.creatine = {};
    data.creatine[key] = !data.creatine[key];
    save(data);
    renderMain();
};

window.addExercise = function() {
    const input = document.getElementById('ex-input');
    if (!input.value.trim()) return;
    const data = load();
    const key = dateKey(getWeekDates()[activeIdx]);
    if (!data.entries[key]) data.entries[key] = [];
    data.entries[key].push({ id: Date.now(), name: input.value.trim(), done: false });
    save(data);
    input.value = '';
    renderMain();
};

window.openReport = () => document.getElementById('overlay').classList.add('open');

// --- INICIALIZAÇÃO E REMOÇÃO DA SPLASH ---
function init() {
    const day = new Date().getDay();
    activeIdx = (day === 0) ? 6 : day - 1;
    renderMain();

    // REGISTRO DO SERVICE WORKER
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }

    // FORÇAR SAÍDA DA SPLASH SCREEN (Independente de erro)
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
            splash.classList.add('hide');
            console.log("Splash removida");
        }
    }, 3000); 
}

// Executa a inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
