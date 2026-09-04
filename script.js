// ========================================
// NEXUS - SISTEMA COMPLETO
// ========================================

console.log('🔵 SCRIPT CARREGADO - v10');

const API_BASE = 'https://nexus-api-mz3t.onrender.com';
const STORAGE_KEY = 'nexus_user';
const USER_NAME_KEY = 'nexus_user_name';
const USER_FULL_KEY = 'nexus_user_full';
const USER_FOTO_KEY = 'nexus_user_foto';

// ========================================
// ESTADO GLOBAL
// ========================================
const state = {
    user: null,
    userName: null,
    userFullName: null,
    userFoto: null,
    currentView: 'dashboard',
    theme: localStorage.getItem('nexus_theme') || 'light',
    transactions: [],
    metas: [],
    resumo: null,
    categories: { receita: [], despesa: [] },
    filterType: null
};

// Guarda o evento de instalação da PWA até o usuário clicar no botão
let deferredInstallPrompt = null;

// Paleta de cores para os gráficos por categoria
const CHART_COLORS = ['#8b7fe8', '#4caf84', '#dc3545', '#f5b86e', '#6a8cff', '#e67ce6', '#4dd0c4', '#f2994a', '#9b59b6', '#2ecc71'];
const dashboardCharts = { receitas: null, despesas: null, balanco: null };
const relatoriosCharts = { receitas: null, despesas: null };

// ========================================
// LEGENDA DE CATEGORIAS (única fonte da verdade)
// Usada no Dashboard, em Relatórios e sempre que o gráfico de rosca
// é (re)desenhado, para que o texto fique idêntico às cores do gráfico.
// ========================================
function renderCategoriaLegend(labels, values, colors) {
    const total = (values || []).reduce((sum, v) => sum + v, 0);

    if (!labels || labels.length === 0 || total === 0) {
        return `<p class="text-muted text-center" style="padding:16px 0;">Sem transações pagas nessa categoria ainda</p>`;
    }

    return labels.map((categoria, i) => {
        const valor = values[i];
        const pct = total > 0 ? ((valor / total) * 100).toFixed(1) : 0;
        const color = colors ? colors[i] : CHART_COLORS[i % CHART_COLORS.length];
        return `
            <div class="legend-row">
                <div class="legend-row-left">
                    <span class="legend-dot" style="background:${color}"></span>
                    <span class="legend-category">${categoria}</span>
                </div>
                <div class="legend-row-right">
                    <span class="legend-value">${formatCurrency(valor)}</span>
                    <span class="legend-pct">(${pct}%)</span>
                </div>
            </div>
        `;
    }).join('');
}

// Atalho: monta a legenda direto a partir dos totais agrupados por categoria
function renderCategoriaLegendFromTotals(totals) {
    const labels = Object.keys(totals);
    const values = Object.values(totals);
    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return renderCategoriaLegend(labels, values, colors);
}

// ========================================
// API CLIENT
// ========================================
const api = {
    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        if (!response.ok) {
            const err = await response.text().catch(() => '');
            throw new Error(err || `HTTP ${response.status}`);
        }
        return response.json();
    },

    async login(usuario, senha) {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ usuario, senha })
        });
    },

    async criarConta(nome, sobrenome, usuario, senha) {
        return this.request('/criar_conta', {
            method: 'POST',
            body: JSON.stringify({ nome, sobrenome, usuario, senha })
        });
    },

    async recuperarSenha(usuario, nova_senha) {
        return this.request('/recuperar_senha', {
            method: 'PUT',
            body: JSON.stringify({ usuario, nova_senha })
        });
    },

    async getResumo(usuario) {
        return this.request(`/transacoes/resumo?usuario=${encodeURIComponent(usuario)}`);
    },

    async listarTransacoes(usuario) {
        return this.request(`/transacoes/listar?usuario=${encodeURIComponent(usuario)}`);
    },

    async listarCategorias() {
        return this.request('/categorias');
    },

    async listarMetas(usuario) {
        return this.request(`/metas/listar?usuario=${encodeURIComponent(usuario)}`);
    },

    async criarTransacao(usuario, tipo, categoria, valor, data, status) {
        return this.request('/transacoes/criar', {
            method: 'POST',
            body: JSON.stringify({ usuario, tipo, categoria, valor, data, status })
        });
    },

    async deletarTransacao(usuario, transacao_id) {
        return this.request('/transacoes/deletar', {
            method: 'DELETE',
            body: JSON.stringify({ usuario, transacao_id })
        });
    },

    async atualizarTransacao(usuario, transacao_id, tipo, categoria, valor, data, status) {
        return this.request('/transacoes/atualizar', {
            method: 'PUT',
            body: JSON.stringify({ usuario, transacao_id, tipo, categoria, valor, data, status })
        });
    },

    async criarMeta(usuario, titulo, salario_liquido, porcentagem_meta) {
        return this.request('/metas/criar', {
            method: 'POST',
            body: JSON.stringify({ usuario, titulo, salario_liquido, porcentagem_meta })
        });
    },

    async atualizarMeta(usuario, titulo_antigo, titulo_novo, salario_liquido, porcentagem_meta) {
        return this.request('/metas/atualizar', {
            method: 'PUT',
            body: JSON.stringify({ usuario, titulo_antigo, titulo_novo, salario_liquido, porcentagem_meta })
        });
    },

    async deletarMeta(usuario, titulo) {
        return this.request(`/metas/deletar?usuario=${encodeURIComponent(usuario)}&titulo=${encodeURIComponent(titulo)}`, {
            method: 'DELETE'
        });
    },

    async marcarParcelaMeta(usuario, titulo, indice) {
        return this.request('/metas/parcela', {
            method: 'PUT',
            body: JSON.stringify({ usuario, titulo, indice })
        });
    },

    async atualizarNomeSobrenome(usuario, nome, sobrenome) {
        return this.request('/atualizar_nome_sobrenome', {
            method: 'PUT',
            body: JSON.stringify({ usuario, nome, sobrenome })
        });
    },

    async atualizarSenha(usuario, senha_antiga, nova_senha) {
        return this.request('/atualizar_senha', {
            method: 'PUT',
            body: JSON.stringify({ usuario, senha_antiga, nova_senha })
        });
    },

    async deletarUsuario(usuario) {
        return this.request(`/deletar_usuario?usuario=${encodeURIComponent(usuario)}`, {
            method: 'DELETE'
        });
    },

    async reiniciarConta(usuario) {
        return this.request(`/reiniciar_conta?usuario=${encodeURIComponent(usuario)}`, {
            method: 'DELETE'
        });
    },

    async atualizarFoto(usuario, foto) {
        return this.request('/atualizar_foto', {
            method: 'PUT',
            body: JSON.stringify({ usuario, foto })
        });
    }
};

// ========================================
// HELPERS
// ========================================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Versão compacta (sem "R$") usada nos quadradinhos pequenos do cofrinho,
// onde o espaço é curto.
function formatCompactCurrency(value) {
    return formatCurrency(value).replace(/^R\$\s*/, '');
}

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
}

function toAPIFormat(dateBR) {
    if (!dateBR) return '';
    const parts = dateBR.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function isDatePastOrToday(dateBR) {
    const parts = dateBR.split('/');
    if (parts.length !== 3) return true;
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d <= today;
}

function maskCurrency(input) {
    let value = input.value.replace(/\D/g, '');
    if (!value) { input.value = ''; return; }
    let intVal = parseInt(value);
    let formatted = (intVal / 100).toFixed(2).replace('.', ',');
    formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = 'R$ ' + formatted;
}

function unmaskCurrency(str) {
    const cleaned = str.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

function formatName(name) {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function renderAvatar(size = 'normal') {
    const cls = size === 'large' ? 'avatar-large' : 'avatar';
    if (state.userFoto) {
        return `<div class="${cls}"><img src="${state.userFoto}" alt="Foto de perfil" /></div>`;
    }
    const inicial = state.userFullName ? state.userFullName.charAt(0).toUpperCase() : '👤';
    return `<div class="${cls}">${inicial}</div>`;
}

function resizeImageToBase64(file, maxDim = 400, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Selecione um arquivo de imagem válido.'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxDim) {
                    height = Math.round(height * (maxDim / width));
                    width = maxDim;
                } else if (height > maxDim) {
                    width = Math.round(width * (maxDim / height));
                    height = maxDim;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-container');
    let container = existing;
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const colors = {
        success: '#4caf84',
        error: '#dc3545',
        info: '#6a8cff'
    };
    toast.style.cssText = `
        padding: 14px 20px; border-radius: 12px; 
        background: var(--bg-card, #fff); color: var(--text-primary, #1a1a2e);
        box-shadow: 0 4px 16px rgba(0,0,0,0.15); 
        border-left: 4px solid ${colors[type] || colors.info};
        animation: slideIn 0.3s ease; font-weight: 500;
        border: 1px solid var(--border-color, #e8e4f0);
    `;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// ROTEAMENTO
// ========================================
function navigate(view, filterType = null) {
    state.currentView = view;
    state.filterType = filterType;
    window.location.hash = `#/${view}`;
    renderView(view);
    updateSidebarActive(view);
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'dashboard';
    if (state.user) {
        renderView(hash);
        updateSidebarActive(hash);
    } else {
        renderView('login');
    }
}

function updateSidebarActive(view) {
    document.querySelectorAll('#sidebar .nav-item').forEach(el => {
        const href = el.getAttribute('href');
        if (href) {
            el.classList.toggle('active', href === `#/${view}`);
        }
    });
}

// ========================================
// SESSÃO
// ========================================
function checkSession() {
    const user = localStorage.getItem(STORAGE_KEY);
    const userName = localStorage.getItem(USER_NAME_KEY);
    const userFull = localStorage.getItem(USER_FULL_KEY);
    const userFoto = localStorage.getItem(USER_FOTO_KEY);
    
    if (!user) return false;
    
    state.user = user;
    state.userName = userName || 'Usuário';
    state.userFullName = userFull || userName || 'Usuário';
    state.userFoto = userFoto || null;
    
    return true;
}

function doLogin(user, nomeCompleto, foto) {
    const nomeFormatado = formatName(nomeCompleto);
    
    state.user = user;
    state.userFullName = nomeFormatado;
    state.userName = nomeFormatado.split(' ')[0];
    state.userFoto = foto || null;
    
    localStorage.setItem(STORAGE_KEY, user);
    localStorage.setItem(USER_NAME_KEY, state.userName);
    localStorage.setItem(USER_FULL_KEY, state.userFullName);
    if (state.userFoto) {
        localStorage.setItem(USER_FOTO_KEY, state.userFoto);
    } else {
        localStorage.removeItem(USER_FOTO_KEY);
    }
    
    navigate('dashboard');
    loadDashboardData();
}

function doLogout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_FULL_KEY);
    localStorage.removeItem(USER_FOTO_KEY);
    
    state.user = null;
    state.userName = null;
    state.userFullName = null;
    state.userFoto = null;
    state.filterType = null;
    
    navigate('login');
}

// ========================================
// LOADERS
// ========================================
async function loadDashboardData() {
    if (!state.user) return;
    try {
        state.resumo = await api.getResumo(state.user);
        const transacoesResp = await api.listarTransacoes(state.user);
        state.transactions = transacoesResp?.transacoes || [];
        state.categories = await api.listarCategorias();
        const metasResp = await api.listarMetas(state.user);
        state.metas = (metasResp?.metas || []).map(m => ({
            ...m,
            porcentagem_meta: m.salario_liquido ? Math.round((m.meta / m.salario_liquido) * 10000) / 100 : 0,
            valor_objetivo: m.meta,
            parcelas: m.parcelas || []
        }));
        renderView(state.currentView);
    } catch (err) {
        console.error('Erro ao carregar dados:', err);
        if (err.message?.includes('400') || err.message?.includes('404')) {
            doLogout();
        }
    }
}

// ========================================
// RENDER VIEWS
// ========================================
function renderView(view) {
    const container = document.getElementById('view-container');
    if (!container) return;

    document.body.classList.toggle('auth-mode', view === 'login');

    switch (view) {
        case 'login': container.innerHTML = renderLogin(); break;
        case 'dashboard': 
            container.innerHTML = renderDashboard(); 
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    renderDashboardCharts();
                } else {
                    checkChartJs();
                }
            }, 50);
            break;
        case 'transacoes': container.innerHTML = renderTransacoes(); break;
        case 'receitas': container.innerHTML = renderTransacoes(); break;
        case 'despesas': container.innerHTML = renderTransacoes(); break;
        case 'planejamento': container.innerHTML = renderPlanejamento(); break;
        case 'relatorios': 
            container.innerHTML = renderRelatorios(); 
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    renderRelatoriosCharts();
                }
            }, 100);
            break;
        case 'configuracoes': container.innerHTML = renderConfiguracoes(); break;
        default: container.innerHTML = '<h2>Página não encontrada</h2>';
    }
    
    bindEvents(view);
}

// ========================================
// VERIFICAÇÃO DO CHART.JS
// ========================================
function checkChartJs() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não carregado. Tentando carregar...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
        script.onload = () => {
            console.log('Chart.js carregado com sucesso!');
            if (state.currentView === 'dashboard') {
                setTimeout(renderDashboardCharts, 100);
            }
            if (state.currentView === 'relatorios') {
                setTimeout(renderRelatoriosCharts, 100);
            }
        };
        script.onerror = () => {
            console.error('Falha ao carregar Chart.js');
            document.querySelectorAll('.chart-wrap canvas').forEach(c => {
                c.style.display = 'none';
                const parent = c.parentElement;
                const msg = document.createElement('p');
                msg.className = 'text-muted text-center';
                msg.textContent = '📊 Gráficos indisponíveis no momento';
                parent.appendChild(msg);
            });
        };
        document.head.appendChild(script);
        return false;
    }
    return true;
}

// ========================================
// RENDER: LOGIN
// ========================================
function renderLogin() {
    return `
        <div class="login-container">
            <h1>💰 Nexus</h1>
            <p class="sub">Entre ou crie sua conta</p>
            <div class="login-tabs">
                <button class="active" data-tab="login">Entrar</button>
                <button data-tab="register">Cadastrar</button>
            </div>
            <div id="login-form-container">
                <form id="login-form">
                    <div class="form-group">
                        <label>Usuário</label>
                        <input type="text" id="login-user" placeholder="seu_usuario" required />
                    </div>
                    <div class="form-group">
                        <label>Senha</label>
                        <input type="password" id="login-pass" placeholder="••••••••" required />
                    </div>
                    <div class="forgot-password-link">
                        <a href="#" id="forgot-password-link">Esqueceu sua senha?</a>
                    </div>
                    <button type="submit" class="btn-primary">Entrar</button>
                </form>
            </div>
            <div id="register-form-container" style="display:none;">
                <form id="register-form">
                    <div class="form-group">
                        <label>Nome</label>
                        <input type="text" id="reg-nome" placeholder="João" required />
                    </div>
                    <div class="form-group">
                        <label>Sobrenome</label>
                        <input type="text" id="reg-sobrenome" placeholder="Silva" required />
                    </div>
                    <div class="form-group">
                        <label>Usuário</label>
                        <input type="text" id="reg-user" placeholder="seu_usuario" required />
                    </div>
                    <div class="form-group">
                        <label>Senha</label>
                        <input type="password" id="reg-pass" placeholder="••••••••" required />
                    </div>
                    <button type="submit" class="btn-primary">Cadastrar</button>
                </form>
            </div>
            <div id="forgot-form-container" style="display:none;">
                <p class="sub" style="margin-bottom:20px;">Informe seu usuário e defina uma nova senha</p>
                <form id="forgot-form">
                    <div class="form-group">
                        <label>Usuário</label>
                        <input type="text" id="forgot-user" placeholder="seu_usuario" required />
                    </div>
                    <div class="form-group">
                        <label>Nova senha</label>
                        <input type="password" id="forgot-pass" placeholder="••••••••" required />
                    </div>
                    <div class="form-group">
                        <label>Confirmar nova senha</label>
                        <input type="password" id="forgot-pass-confirm" placeholder="••••••••" required />
                    </div>
                    <button type="submit" class="btn-primary">Atualizar Senha</button>
                </form>
                <div class="forgot-back-link">
                    <a href="#" id="forgot-back-link">← Voltar para o login</a>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// RENDER: DASHBOARD
// ========================================
function renderDashboard() {
    const saldo = state.resumo?.saldo || 0;
    const receitas = state.resumo?.receitas || 0;
    const despesas = state.resumo?.despesas || 0;
    const nome = state.userName || 'Usuário';
    const fullName = state.userFullName || 'Usuário';

    return `
        <div class="view">
            <div class="dashboard-header">
                <h1>👋 Olá, ${nome}</h1>
                <div class="user-profile" onclick="navigate('configuracoes')">
                    ${renderAvatar('normal')}
                    <span>${fullName}</span>
                </div>
            </div>

            <div class="card-grid">
                <div class="card stat-info" style="cursor:pointer;" onclick="navigate('transacoes')">
                    <div class="card-title">💰 Saldo Atual</div>
                    <div class="card-value">${formatCurrency(saldo)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">Clique para ver todas</div>
                </div>
                <div class="card stat-success" style="cursor:pointer;" onclick="navigate('receitas')">
                    <div class="card-title">📈 Receitas</div>
                    <div class="card-value">${formatCurrency(receitas)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">Clique para ver receitas</div>
                </div>
                <div class="card stat-danger" style="cursor:pointer;" onclick="navigate('despesas')">
                    <div class="card-title">📉 Despesas</div>
                    <div class="card-value">${formatCurrency(despesas)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">Clique para ver despesas</div>
                </div>
            </div>

            <div class="card-grid-2">
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h3>Receitas por Categoria</h3>
                        <button class="btn-secondary" style="padding:4px 12px;font-size:0.75rem;" onclick="navigate('relatorios')">VER MAIS →</button>
                    </div>
                    <div class="chart-wrap"><canvas id="chart-receitas"></canvas></div>
                    <div id="legend-receitas" class="legend-list" style="margin-top:12px;">
                        ${renderCategoriaLegendFromTotals(groupByCategoria('receita'))}
                    </div>
                    <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:2px solid var(--border-color);font-weight:600;color:var(--text-primary);">
                        ${formatCurrency(receitas)} Total
                    </div>
                </div>
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h3>Despesas por Categoria</h3>
                        <button class="btn-secondary" style="padding:4px 12px;font-size:0.75rem;" onclick="navigate('relatorios')">VER MAIS →</button>
                    </div>
                    <div class="chart-wrap"><canvas id="chart-despesas"></canvas></div>
                    <div id="legend-despesas" class="legend-list" style="margin-top:12px;">
                        ${renderCategoriaLegendFromTotals(groupByCategoria('despesa'))}
                    </div>
                    <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:2px solid var(--border-color);font-weight:600;color:var(--text-primary);">
                        ${formatCurrency(despesas)} Total
                    </div>
                </div>
            </div>

            <div class="card-grid" style="grid-template-columns: 1fr;">
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h3>Balanço Mensal</h3>
                        <button class="btn-secondary" style="padding:4px 12px;font-size:0.75rem;" onclick="navigate('relatorios')">VER MAIS →</button>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--bg-input);border-radius:8px;">
                            <span style="font-weight:500;font-size:0.95rem;">Receitas</span>
                            <span style="color:var(--color-success);font-weight:600;font-size:1rem;">${formatCurrency(receitas)}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--bg-input);border-radius:8px;">
                            <span style="font-weight:500;font-size:0.95rem;">Despesas</span>
                            <span style="color:var(--color-danger);font-weight:600;font-size:1rem;">${formatCurrency(despesas)}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--bg-input);border-radius:8px;border:2px solid var(--color-purple);">
                            <span style="font-weight:700;font-size:1rem;">Balanço</span>
                            <span style="color:var(--color-purple);font-weight:700;font-size:1.1rem;">${formatCurrency(receitas - despesas)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 class="mb-md">🎯 Planejamento</h3>
                ${state.metas && state.metas.length > 0 ? `
                    <div class="row-between">
                        <div><strong>${state.metas[0].titulo}</strong></div>
                        <div>
                            <div style="font-size:0.7rem;color:var(--text-muted);">Salário Líquido</div>
                            <strong>${formatCurrency(state.metas[0].salario_liquido)}</strong>
                        </div>
                        <div>
                            <div style="font-size:0.7rem;color:var(--text-muted);">Porcentagem da Meta (%)</div>
                            <strong>${state.metas[0].porcentagem_meta}%</strong>
                        </div>
                        <button class="btn-secondary" onclick="navigate('planejamento')">Ver detalhes →</button>
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>Opa! Você ainda não possui um planejamento definido para este mês.</p>
                        <button class="btn-primary" onclick="navigate('planejamento')">Definir meu planejamento</button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function groupByCategoria(tipo) {
    const totals = {};
    (state.transactions || [])
        .filter(t => t.tipo === tipo && (t.status === 'pago' || t.status === 'efetuada'))
        .forEach(t => { totals[t.categoria] = (totals[t.categoria] || 0) + Number(t.valor); });
    return totals;
}

function renderDoughnutChart(canvasId, legendId, totals, key, chartsObj) {
    const canvas = document.getElementById(canvasId);
    const legendEl = document.getElementById(legendId);
    if (!canvas) return;

    if (chartsObj[key]) {
        chartsObj[key].destroy();
        chartsObj[key] = null;
    }

    const labels = Object.keys(totals);
    const values = Object.values(totals);
    const total = values.reduce((a, b) => a + b, 0);

    if (labels.length === 0 || total === 0) {
        canvas.style.display = 'none';
        if (legendEl) {
            legendEl.innerHTML = `<p class="text-muted text-center" style="padding:16px 0;">Sem transações pagas nessa categoria ainda</p>`;
        }
        return;
    }
    canvas.style.display = '';

    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    if (typeof Chart === 'undefined') {
        if (legendEl) {
            legendEl.innerHTML = `<p class="text-muted text-center">Não foi possível carregar a biblioteca de gráficos</p>`;
        }
        return;
    }

    chartsObj[key] = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(1)}%)`
                    }
                }
            }
        }
    });

    if (legendEl) {
        legendEl.classList.add('legend-list');
        legendEl.innerHTML = renderCategoriaLegend(labels, values, colors);
    }
}

function renderDashboardCharts() {
    const receitasTotals = groupByCategoria('receita');
    const despesasTotals = groupByCategoria('despesa');
    
    renderDoughnutChart('chart-receitas', 'legend-receitas', receitasTotals, 'receitas', dashboardCharts);
    renderDoughnutChart('chart-despesas', 'legend-despesas', despesasTotals, 'despesas', dashboardCharts);
}

function renderRelatoriosCharts() {
    const receitasTotals = groupByCategoria('receita');
    const despesasTotals = groupByCategoria('despesa');
    
    renderDoughnutChart('chart-rel-receitas', 'legend-rel-receitas', receitasTotals, 'receitas', relatoriosCharts);
    renderDoughnutChart('chart-rel-despesas', 'legend-rel-despesas', despesasTotals, 'despesas', relatoriosCharts);
}

// ========================================
// RENDER: TRANSAÇÕES
// ========================================
function renderTransacoes() {
    const saldo = state.resumo?.saldo || 0;
    const receitas = state.resumo?.receitas || 0;
    const despesas = state.resumo?.despesas || 0;
    
    let transacoes = state.transactions || [];
    
    const view = state.currentView;
    if (view === 'receitas') {
        transacoes = transacoes.filter(t => t.tipo === 'receita');
    } else if (view === 'despesas') {
        transacoes = transacoes.filter(t => t.tipo === 'despesa');
    }
    
    const titulo = view === 'receitas' ? '💰 Receitas' : view === 'despesas' ? '💸 Despesas' : '💳 Transações';

    return `
        <div class="view">
            <div class="page-header">
                <h1>${titulo}</h1>
                <button class="btn-primary" onclick="openTransactionModal()">+ Nova Transação</button>
            </div>

            <div class="card-grid">
                <div class="card stat-info" style="cursor:pointer;" onclick="navigate('transacoes')">
                    <div class="card-title">💰 Saldo</div>
                    <div class="card-value">${formatCurrency(saldo)}</div>
                </div>
                <div class="card stat-success" style="cursor:pointer;" onclick="navigate('receitas')">
                    <div class="card-title">📈 Receitas</div>
                    <div class="card-value">${formatCurrency(receitas)}</div>
                </div>
                <div class="card stat-danger" style="cursor:pointer;" onclick="navigate('despesas')">
                    <div class="card-title">📉 Despesas</div>
                    <div class="card-value">${formatCurrency(despesas)}</div>
                </div>
            </div>

            <div class="mb-md">
                <button id="bulk-delete-btn" class="btn-danger-strong" onclick="bulkDelete()">Deletar Selecionados</button>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width:30px;">
                                <input type="checkbox" id="select-all" onchange="toggleAllCheckboxes()" />
                            </th>
                            <th>Categoria</th>
                            <th>Valor</th>
                            <th>Data</th>
                            <th>Status</th>
                            <th style="text-align:center;width:60px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transacoes.length === 0 ? `
                            <tr><td colspan="6" class="text-center text-muted" style="padding:24px;">Nenhuma transação encontrada</td></tr>
                        ` : transacoes.map(tx => {
                            const isPago = tx.status === 'pago' || tx.status === 'efetuada';
                            const statusText = isPago ? '✅ Paga' : '⏳ Pendente';
                            const statusClass = isPago ? 'badge-success' : 'badge-warning';
                            const valorColor = tx.tipo === 'receita' ? 'var(--color-success)' : 'var(--color-danger)';
                            return `
                                <tr>
                                    <td class="td-checkbox"><input type="checkbox" class="row-select" data-id="${tx.id}" onchange="updateBulkDeleteButton()" /></td>
                                    <td data-label="Categoria">${tx.categoria}</td>
                                    <td data-label="Valor" style="color:${valorColor};">${formatCurrency(tx.valor)}</td>
                                    <td data-label="Data">${formatDateBR(tx.data)}</td>
                                    <td data-label="Status"><span class="badge ${statusClass}">${statusText}</span></td>
                                    <td class="td-actions" style="text-align:center;position:relative;">
                                        <button class="action-dots" onclick="toggleActionMenu(event, '${tx.id}')">⋮</button>
                                        <div id="action-menu-${tx.id}" class="action-menu" style="display:none;position:fixed;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;box-shadow:var(--shadow-lg);z-index:9999;min-width:140px;padding:8px 0;overflow:hidden;">
                                            <button class="action-menu-item" onclick="editTransaction('${tx.id}')" style="display:block;width:100%;padding:10px 20px;border:none;background:none;color:var(--text-primary);cursor:pointer;text-align:left;font-size:0.9rem;transition:background 0.2s;">✏️ Editar</button>
                                            <button class="action-menu-item" onclick="deleteTransaction('${tx.id}')" style="display:block;width:100%;padding:10px 20px;border:none;background:none;color:var(--color-danger);cursor:pointer;text-align:left;font-size:0.9rem;transition:background 0.2s;border-top:1px solid var(--border-color);">🗑️ Excluir</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ========================================
// RENDER: PLANEJAMENTO
// ========================================
const TOTAL_PARCELAS_META = 12;

function renderPlanejamento() {
    const meta = state.metas && state.metas.length > 0 ? state.metas[0] : null;
    const metaTotal = meta ? (meta.valor_objetivo ?? meta.salario_liquido * (meta.porcentagem_meta / 100)) : 0;
    const parcelasConcluidas = meta ? (meta.parcelas || []) : [];
    const valorParcela = metaTotal / TOTAL_PARCELAS_META;
    const valorAtual = parcelasConcluidas.length * valorParcela;

    return `
        <div class="view">
            <h1>🎯 Planejamento</h1>

            <div class="card">
                <h3>${meta ? 'Editar Meta' : 'Criar Meta'}</h3>
                <form id="meta-form">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" id="meta-titulo" value="${meta ? meta.titulo : ''}" placeholder="Ex: Viagem" required />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Salário Líquido</label>
                            <input type="text" id="meta-salario" value="${meta ? 'R$ ' + meta.salario_liquido.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}" placeholder="R$ 0,00" oninput="maskCurrency(this)" />
                        </div>
                        <div class="form-group">
                            <label>Porcentagem da Meta (%)</label>
                            <input type="number" id="meta-porcentagem" value="${meta ? meta.porcentagem_meta : ''}" placeholder="10" min="0" max="100" required />
                        </div>
                    </div>
                    <button type="submit" class="btn-primary">${meta ? 'Atualizar' : 'Criar'}</button>
                    ${meta ? `<button type="button" class="btn-danger" onclick="deleteMeta('${meta.titulo}')" style="margin-left:8px;">Deletar</button>` : ''}
                </form>
            </div>

            ${meta ? `
                <div class="card">
                    <h3 class="mb-md">📊 Resumo da Meta</h3>
                    <div class="summary-list">
                        <div><strong>Valor Atual:</strong> <span style="color:var(--color-success);font-weight:700;">${formatCurrency(valorAtual)}</span></div>
                        <div><strong>Meta Total:</strong> ${formatCurrency(metaTotal)}</div>
                        <div><strong>Porcentagem:</strong> ${meta.porcentagem_meta}%</div>
                        <div><strong>Salário:</strong> ${formatCurrency(meta.salario_liquido)}</div>
                    </div>
                    <div class="text-center text-muted mb-md" style="background:var(--bg-input);border-radius:12px;padding:16px;">
                        🎯 Clique nos quadradinhos para marcar uma parcela como guardada. Uma vez marcada, ela fica salva para sempre.
                    </div>
                    <div class="cofrinho-grid">
                        ${Array.from({length: TOTAL_PARCELAS_META}, (_, i) => {
                            const concluida = parcelasConcluidas.includes(i);
                            return `
                                <div class="cofrinho-cell${concluida ? ' completed' : ''}"
                                     data-index="${i}"
                                     data-titulo="${meta.titulo}"
                                     onclick="${concluida ? '' : `toggleCofrinho(this)`}"
                                     title="${concluida ? 'Parcela guardada — não pode ser desmarcada' : `Marcar ${formatCurrency(valorParcela)} como guardado`}">
                                    ${formatCompactCurrency(valorParcela)}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : `
                <div class="card">
                    <div class="empty-state">
                        <p>Opa! Você ainda não possui um planejamento definido para este mês.</p>
                        <button class="btn-primary" onclick="navigate('planejamento')">Definir meu planejamento</button>
                    </div>
                </div>
            `}
        </div>
    `;
}

// ========================================
// RENDER: RELATÓRIOS
// ========================================
function renderRelatorios() {
    const receitas = state.resumo?.receitas || 0;
    const despesas = state.resumo?.despesas || 0;
    const balanco = receitas - despesas;
    
    const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const mesCapitalizado = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);
    
    function renderBalancoMensal() {
        return `
            <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--bg-input);border-radius:8px;">
                    <span style="font-weight:500;font-size:0.95rem;">Receitas</span>
                    <span style="color:var(--color-success);font-weight:600;font-size:1rem;">${formatCurrency(receitas)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--bg-input);border-radius:8px;">
                    <span style="font-weight:500;font-size:0.95rem;">Despesas</span>
                    <span style="color:var(--color-danger);font-weight:600;font-size:1rem;">${formatCurrency(despesas)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--bg-input);border-radius:8px;border:2px solid var(--color-purple);">
                    <span style="font-weight:700;font-size:1rem;">Balanço</span>
                    <span style="color:var(--color-purple);font-weight:700;font-size:1.1rem;">${formatCurrency(balanco)}</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="view">
            <h1>📈 Relatórios</h1>
            
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h3>${mesCapitalizado}</h3>
                </div>
                
                <h4 style="margin-bottom:12px;color:var(--text-secondary);font-weight:500;">Balanço Mensal</h4>
                ${renderBalancoMensal()}
            </div>

            <div class="card" style="margin-top:24px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h4 style="color:var(--text-secondary);font-weight:500;">Receitas por Categorias</h4>
                </div>
                <div class="chart-wrap" style="max-width:220px;height:180px;margin:0 auto 12px;">
                    <canvas id="chart-rel-receitas"></canvas>
                </div>
                <div id="legend-rel-receitas" class="legend-list" style="margin-top:12px;">
                    ${renderCategoriaLegendFromTotals(groupByCategoria('receita'))}
                </div>
                ${Object.keys(groupByCategoria('receita')).length > 0 ? `
                    <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:2px solid var(--border-color);font-weight:600;color:var(--text-primary);">
                        ${formatCurrency(receitas)} Total
                    </div>
                ` : ''}
            </div>

            <div class="card" style="margin-top:24px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h4 style="color:var(--text-secondary);font-weight:500;">Despesas por Categorias</h4>
                </div>
                <div class="chart-wrap" style="max-width:220px;height:180px;margin:0 auto 12px;">
                    <canvas id="chart-rel-despesas"></canvas>
                </div>
                <div id="legend-rel-despesas" class="legend-list" style="margin-top:12px;">
                    ${renderCategoriaLegendFromTotals(groupByCategoria('despesa'))}
                </div>
                ${Object.keys(groupByCategoria('despesa')).length > 0 ? `
                    <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:2px solid var(--border-color);font-weight:600;color:var(--text-primary);">
                        ${formatCurrency(despesas)} Total
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ========================================
// RENDER: CONFIGURAÇÕES
// ========================================
function renderConfiguracoes() {
    return `
        <div class="view">
            <h1>⚙️ Configurações</h1>

            <div class="card">
                <h3 class="mb-md">👤 Perfil</h3>
                <div class="avatar-upload-row">
                    ${renderAvatar('large')}
                    <div class="avatar-upload-info">
                        <div><strong>Nome:</strong> ${state.userFullName || ''}</div>
                        <div><strong>Usuário:</strong> ${state.user || ''}</div>
                    </div>
                </div>
                <div class="avatar-upload-actions">
                    <label for="foto-input" class="btn-secondary">📷 Alterar Foto</label>
                    <input type="file" id="foto-input" accept="image/*" class="visually-hidden-input" />
                    ${state.userFoto ? `<button class="btn-secondary" onclick="removeProfilePhoto()">Remover Foto</button>` : ''}
                    <button class="btn-secondary" onclick="updateProfile()">✏️ Editar Nome</button>
                </div>
            </div>

            <div class="card">
                <h3 class="mb-md">🔐 Alterar Senha</h3>
                <form id="change-password-form">
                    <div class="form-group">
                        <label>Senha Antiga</label>
                        <input type="password" id="old-pass" placeholder="••••••••" required />
                    </div>
                    <div class="form-group">
                        <label>Nova Senha</label>
                        <input type="password" id="new-pass" placeholder="••••••••" required />
                    </div>
                    <button type="submit" class="btn-primary">Alterar Senha</button>
                </form>
            </div>

            <div class="card">
                <h3 class="mb-md">🎨 Tema</h3>
                <div class="row-wrap-sm">
                    <button class="btn-secondary" onclick="setTheme('light')">☀️ Claro</button>
                    <button class="btn-secondary" onclick="setTheme('dark')">🌙 Escuro</button>
                </div>
            </div>

            <div class="card" style="border-color:var(--color-danger);">
                <h3 class="mb-md" style="color:var(--color-danger);">⚠️ Ações de Conta</h3>
                <div class="row-wrap-sm">
                    <button class="btn-danger" onclick="resetAccount()">🔄 Resetar Conta</button>
                    <button class="btn-danger" onclick="deleteAccount()">Excluir Conta</button>
                    <button class="btn-secondary" onclick="doLogout()">🚪 Sair</button>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// EVENT BINDING
// ========================================
function bindEvents(view) {
    document.querySelectorAll('.login-tabs button').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.login-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const isLogin = btn.dataset.tab === 'login';
            document.getElementById('login-form-container').style.display = isLogin ? 'block' : 'none';
            document.getElementById('register-form-container').style.display = isLogin ? 'none' : 'block';
        };
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const user = document.getElementById('login-user').value.trim();
            const pass = document.getElementById('login-pass').value;
            if (!user || !pass) { showToast('Preencha todos os campos', 'error'); return; }
            try {
                const result = await api.login(user, pass);
                if (result && result.nome) {
                    doLogin(user, result.nome, result.foto);
                    showToast(result.boas_vindas || `Bem-vindo, ${result.nome}!`, 'success');
                }
            } catch (err) {
                showToast('Erro: ' + (err.message || 'Falha no login'), 'error');
            }
        };
    }

    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            document.querySelector('.login-tabs').style.display = 'none';
            document.getElementById('login-form-container').style.display = 'none';
            document.getElementById('register-form-container').style.display = 'none';
            document.getElementById('forgot-form-container').style.display = 'block';
        };
    }

    const forgotBackLink = document.getElementById('forgot-back-link');
    if (forgotBackLink) {
        forgotBackLink.onclick = (e) => {
            e.preventDefault();
            document.getElementById('forgot-form-container').style.display = 'none';
            document.querySelector('.login-tabs').style.display = 'flex';
            document.querySelectorAll('.login-tabs button').forEach(b => b.classList.remove('active'));
            document.querySelector('.login-tabs button[data-tab="login"]')?.classList.add('active');
            document.getElementById('login-form-container').style.display = 'block';
            document.getElementById('register-form-container').style.display = 'none';
        };
    }

    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            const user = document.getElementById('forgot-user').value.trim();
            const pass = document.getElementById('forgot-pass').value;
            const passConfirm = document.getElementById('forgot-pass-confirm').value;
            if (!user || !pass || !passConfirm) {
                showToast('Preencha todos os campos', 'error');
                return;
            }
            if (pass !== passConfirm) {
                showToast('As senhas não coincidem', 'error');
                return;
            }
            try {
                await api.recuperarSenha(user, pass);
                showToast('Senha atualizada com sucesso! Faça login.', 'success');
                forgotBackLink.onclick(new Event('click'));
            } catch (err) {
                showToast('Erro: ' + (err.message || 'Falha ao atualizar senha'), 'error');
            }
        };
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const nome = document.getElementById('reg-nome').value.trim();
            const sobrenome = document.getElementById('reg-sobrenome').value.trim();
            const user = document.getElementById('reg-user').value.trim();
            const pass = document.getElementById('reg-pass').value;
            if (!nome || !sobrenome || !user || !pass) {
                showToast('Preencha todos os campos', 'error');
                return;
            }
            try {
                await api.criarConta(nome, sobrenome, user, pass);
                showToast('Conta criada com sucesso! Faça login.', 'success');
                document.querySelector('.login-tabs button[data-tab="login"]')?.click();
            } catch (err) {
                showToast('Erro: ' + (err.message || ''), 'error');
            }
        };
    }

    const metaForm = document.getElementById('meta-form');
    if (metaForm) {
        metaForm.onsubmit = async (e) => {
            e.preventDefault();
            const titulo = document.getElementById('meta-titulo').value.trim();
            const salarioStr = document.getElementById('meta-salario').value;
            const porcentagem = parseFloat(document.getElementById('meta-porcentagem').value);
            const salario = unmaskCurrency(salarioStr);
            if (!titulo || !salario || isNaN(porcentagem)) {
                showToast('Preencha todos os campos', 'error');
                return;
            }
            const meta = state.metas && state.metas.length > 0 ? state.metas[0] : null;
            try {
                if (meta) {
                    await api.atualizarMeta(state.user, meta.titulo, titulo, salario, porcentagem);
                    showToast('Meta atualizada!', 'success');
                } else {
                    await api.criarMeta(state.user, titulo, salario, porcentagem);
                    showToast('Meta criada!', 'success');
                }
                await loadDashboardData();
            } catch (err) {
                showToast('Erro: ' + (err.message || ''), 'error');
            }
        };
    }

    const fotoInput = document.getElementById('foto-input');
    if (fotoInput) {
        fotoInput.onchange = async () => {
            const file = fotoInput.files && fotoInput.files[0];
            if (!file) return;
            try {
                const base64 = await resizeImageToBase64(file);
                await api.atualizarFoto(state.user, base64);
                state.userFoto = base64;
                localStorage.setItem(USER_FOTO_KEY, base64);
                showToast('Foto atualizada!', 'success');
                renderView('configuracoes');
            } catch (err) {
                showToast('Erro: ' + (err.message || 'Não foi possível enviar a foto'), 'error');
            } finally {
                fotoInput.value = '';
            }
        };
    }

    const passForm = document.getElementById('change-password-form');
    if (passForm) {
        passForm.onsubmit = async (e) => {
            e.preventDefault();
            const oldPass = document.getElementById('old-pass').value;
            const newPass = document.getElementById('new-pass').value;
            if (!oldPass || !newPass) { showToast('Preencha todos os campos', 'error'); return; }
            try {
                await api.atualizarSenha(state.user, oldPass, newPass);
                showToast('Senha alterada com sucesso!', 'success');
                passForm.reset();
            } catch (err) {
                showToast('Erro: ' + (err.message || ''), 'error');
            }
        };
    }
}

// ========================================
// AÇÕES GLOBAIS
// ========================================
window.navigate = navigate;
window.doLogout = doLogout;

window.setTheme = (theme) => {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
    localStorage.setItem('nexus_theme', theme);
    const icon = document.getElementById('theme-toggle');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
};

window.maskCurrency = maskCurrency;

window.toggleCofrinho = async (el) => {
    // Só permite marcar (nunca desmarcar). Uma parcela já concluída não tem
    // onclick (ver renderPlanejamento), então chegar aqui significa que
    // ainda está pendente.
    if (el.classList.contains('completed') || el.classList.contains('loading')) return;

    const indice = parseInt(el.dataset.index, 10);
    const titulo = el.dataset.titulo;
    const textoOriginal = el.textContent;

    el.classList.add('loading');
    el.textContent = '...';

    try {
        const resp = await api.marcarParcelaMeta(state.user, titulo, indice);

        // Atualiza o estado local com o que o servidor confirmou salvo,
        // para refletir exatamente o que está persistido no banco.
        const meta = state.metas && state.metas.length > 0 ? state.metas[0] : null;
        if (meta) meta.parcelas = resp.parcelas || meta.parcelas;

        el.classList.remove('loading');
        el.classList.add('completed');
        el.onclick = null;
        el.textContent = textoOriginal;
        el.title = 'Parcela guardada — não pode ser desmarcada';

        // Atualiza o "Valor Atual" no resumo sem precisar recarregar a página.
        renderView(state.currentView);
        showToast('Parcela guardada com sucesso!', 'success');
    } catch (err) {
        console.error('Erro ao salvar parcela:', err);
        el.classList.remove('loading');
        el.textContent = textoOriginal;
        showToast('Não foi possível salvar a parcela. Tente novamente.', 'error');
    }
};

window.toggleActionMenu = (event, id) => {
    event.stopPropagation();
    
    document.querySelectorAll('.action-menu').forEach(menu => {
        if (menu.id !== `action-menu-${id}`) {
            menu.style.display = 'none';
        }
    });
    
    const menu = document.getElementById(`action-menu-${id}`);
    if (menu) {
        const isVisible = menu.style.display === 'block';
        document.querySelectorAll('.action-menu').forEach(m => m.style.display = 'none');
        if (!isVisible) {
            menu.style.display = 'block';
            const rect = event.target.getBoundingClientRect();
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.left = (rect.left - 60) + 'px';
            
            const menuRect = menu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth) {
                menu.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
            }
            if (menuRect.bottom > window.innerHeight) {
                menu.style.top = (rect.top - menuRect.height - 4) + 'px';
            }
        }
    }
};

document.addEventListener('click', function(e) {
    if (!e.target.closest('.action-menu') && !e.target.closest('.action-dots')) {
        document.querySelectorAll('.action-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

window.toggleAllCheckboxes = () => {
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('.row-select');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateBulkDeleteButton();
};

window.updateBulkDeleteButton = () => {
    const checked = document.querySelectorAll('.row-select:checked').length;
    const btn = document.getElementById('bulk-delete-btn');
    if (btn) {
        if (checked > 0) {
            btn.classList.add('show');
            btn.textContent = `Deletar ${checked} Selecionado${checked > 1 ? 's' : ''}`;
        } else {
            btn.classList.remove('show');
        }
    }
};

window.bulkDelete = async () => {
    const selected = document.querySelectorAll('.row-select:checked');
    if (selected.length === 0) {
        showToast('Selecione ao menos uma transação', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2>⚠️ Confirmar exclusão</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">Tem certeza que deseja excluir <strong>${selected.length}</strong> transação(ões)? Esta ação não pode ser desfeita.</p>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn-danger" id="confirm-bulk-delete">Excluir</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    
    document.getElementById('confirm-bulk-delete').addEventListener('click', async () => {
        modal.remove();
        let deleted = 0;
        for (const cb of selected) {
            try {
                await api.deletarTransacao(state.user, cb.dataset.id);
                deleted++;
            } catch (e) { /* ignora */ }
        }
        showToast(`${deleted} transações deletadas!`, 'success');
        await loadDashboardData();
    });
};

window.editTransaction = (id) => {
    document.querySelectorAll('.action-menu').forEach(menu => menu.style.display = 'none');
    
    const tx = state.transactions.find(t => String(t.id) === String(id));
    if (!tx) { showToast('Transação não encontrada', 'error'); return; }
    openTransactionModal(tx);
};

window.deleteTransaction = async (id) => {
    document.querySelectorAll('.action-menu').forEach(menu => menu.style.display = 'none');
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2>⚠️ Confirmar exclusão</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.</p>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn-danger" id="confirm-delete">Excluir</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    
    document.getElementById('confirm-delete').addEventListener('click', async () => {
        modal.remove();
        try {
            await api.deletarTransacao(state.user, id);
            showToast('Transação deletada!', 'success');
            await loadDashboardData();
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    });
};

window.deleteMeta = async (titulo) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2>⚠️ Confirmar exclusão</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">Tem certeza que deseja excluir a meta <strong>"${titulo}"</strong>? Esta ação não pode ser desfeita.</p>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn-danger" id="confirm-meta-delete">Excluir</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    
    document.getElementById('confirm-meta-delete').addEventListener('click', async () => {
        modal.remove();
        try {
            await api.deletarMeta(state.user, titulo);
            showToast('Meta deletada!', 'success');
            await loadDashboardData();
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    });
};

window.removeProfilePhoto = async () => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2>⚠️ Confirmar remoção</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">Tem certeza que deseja remover sua foto de perfil?</p>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn-danger" id="confirm-photo-remove">Remover</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    
    document.getElementById('confirm-photo-remove').addEventListener('click', async () => {
        modal.remove();
        try {
            await api.atualizarFoto(state.user, '');
            state.userFoto = null;
            localStorage.removeItem(USER_FOTO_KEY);
            showToast('Foto removida!', 'success');
            renderView('configuracoes');
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    });
};

window.updateProfile = async () => {
    const nome = prompt('Novo nome:', state.userFullName?.split(' ')[0] || '');
    const sobrenome = prompt('Novo sobrenome:', state.userFullName?.split(' ').slice(1).join(' ') || '');
    if (nome === null || sobrenome === null) return;
    try {
        await api.atualizarNomeSobrenome(state.user, nome, sobrenome);
        const nomeCompleto = `${nome} ${sobrenome}`.trim();
        const nomeFormatado = formatName(nomeCompleto);
        
        state.userFullName = nomeFormatado;
        state.userName = nomeFormatado.split(' ')[0];
        
        localStorage.setItem(USER_NAME_KEY, state.userName);
        localStorage.setItem(USER_FULL_KEY, state.userFullName);
        
        showToast('Perfil atualizado!', 'success');
        renderView('configuracoes');
    } catch (err) {
        showToast('Erro: ' + (err.message || ''), 'error');
    }
};

window.resetAccount = async () => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2>⚠️ Confirmar reset</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">Tem certeza que deseja resetar sua conta? Todos os dados serão apagados.</p>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn-danger" id="confirm-reset">Resetar</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    
    document.getElementById('confirm-reset').addEventListener('click', async () => {
        modal.remove();
        try {
            await api.reiniciarConta(state.user);
            showToast('Conta resetada!', 'success');
            doLogout();
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    });
};

window.deleteAccount = async () => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2>⚠️ Confirmar exclusão</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">Tem certeza que deseja <strong>EXCLUIR</strong> sua conta permanentemente? Esta ação é irreversível!</p>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn-danger" id="confirm-account-delete">Excluir Conta</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    
    document.getElementById('confirm-account-delete').addEventListener('click', async () => {
        modal.remove();
        try {
            await api.deletarUsuario(state.user);
            showToast('Conta excluída!', 'success');
            doLogout();
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    });
};

function computeStatusFromDate(dataStr) {
    const hoje = new Date().toISOString().split('T')[0];
    return dataStr && dataStr <= hoje ? 'pago' : 'pendente';
}

function categoriaOptionsHTML(tipo, selecionada) {
    const lista = (state.categories && state.categories[tipo]) || [];
    if (lista.length === 0) {
        return `<option value="">Nenhuma categoria disponível</option>`;
    }
    return lista.map(cat => `<option value="${cat}" ${cat === selecionada ? 'selected' : ''}>${cat}</option>`).join('');
}

function statusPreviewHTML(dataStr) {
    const status = computeStatusFromDate(dataStr);
    return status === 'pago'
        ? `<span class="badge badge-success">✅ Será efetuada (data já chegou)</span>`
        : `<span class="badge badge-warning">⏳ Ficará pendente até a data</span>`;
}

window.openTransactionModal = (tx = null) => {
    const isEdicao = !!tx;
    
    let tipoInicial = 'receita';
    if (state.currentView === 'receitas') {
        tipoInicial = 'receita';
    } else if (state.currentView === 'despesas') {
        tipoInicial = 'despesa';
    } else if (tx) {
        tipoInicial = tx.tipo;
    }
    
    const isRestricted = state.currentView === 'receitas' || state.currentView === 'despesas';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>${isEdicao ? '✏️ Editar Transação' : '➕ Nova Transação'}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <form id="transaction-form">
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="tx-tipo" required ${isRestricted ? 'disabled' : ''}>
                        <option value="receita" ${tipoInicial === 'receita' ? 'selected' : ''}>💰 Receita</option>
                        <option value="despesa" ${tipoInicial === 'despesa' ? 'selected' : ''}>💸 Despesa</option>
                    </select>
                    ${isRestricted ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">${state.currentView === 'receitas' ? '📌 Página de Receitas - apenas receitas permitidas' : '📌 Página de Despesas - apenas despesas permitidas'}</div>` : ''}
                </div>
                <div class="form-group">
                    <label>Categoria</label>
                    <select id="tx-categoria" required>
                        ${categoriaOptionsHTML(tipoInicial, tx ? tx.categoria : null)}
                    </select>
                </div>
                <div class="form-group">
                    <label>Valor</label>
                    <input type="text" id="tx-valor" placeholder="R$ 0,00" oninput="maskCurrency(this)" required />
                </div>
                <div class="form-group">
                    <label>Data</label>
                    <input type="date" id="tx-data" required />
                </div>
                <div class="form-group">
                    <label>Status (automático pela data)</label>
                    <div id="tx-status-preview"></div>
                </div>
                <button type="submit" class="btn-primary" style="width:100%;">${isEdicao ? 'Salvar Alterações' : 'Criar Transação'}</button>
            </form>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    const tipoSelect = document.getElementById('tx-tipo');
    const categoriaSelect = document.getElementById('tx-categoria');
    const dataInput = document.getElementById('tx-data');
    const valorInput = document.getElementById('tx-valor');
    const statusPreview = document.getElementById('tx-status-preview');

    if (!isRestricted) {
        tipoSelect.addEventListener('change', function() {
            const tipo = this.value;
            const categorias = state.categories[tipo] || [];
            categoriaSelect.innerHTML = categorias.map(cat => 
                `<option value="${cat}">${cat}</option>`
            ).join('');
            if (categorias.length === 0) {
                categoriaSelect.innerHTML = `<option value="">Nenhuma categoria disponível</option>`;
            }
        });
    }

    dataInput.value = tx ? tx.data : new Date().toISOString().split('T')[0];
    if (tx) {
        valorInput.value = 'R$ ' + tx.valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        const categorias = state.categories[tipoInicial] || [];
        if (categorias.length > 0 && tx.categoria) {
            categoriaSelect.value = tx.categoria;
        }
    }
    statusPreview.innerHTML = statusPreviewHTML(dataInput.value);

    dataInput.addEventListener('change', () => {
        statusPreview.innerHTML = statusPreviewHTML(dataInput.value);
    });

    document.getElementById('transaction-form').onsubmit = async (e) => {
        e.preventDefault();
        const tipo = tipoSelect.value;
        const categoria = categoriaSelect.value;
        const valor = unmaskCurrency(valorInput.value);
        const data = dataInput.value;
        const status = computeStatusFromDate(data);

        if (!valor) { showToast('Digite um valor válido', 'error'); return; }
        if (!categoria) { showToast('Selecione uma categoria', 'error'); return; }

        try {
            if (isEdicao) {
                await api.atualizarTransacao(state.user, tx.id, tipo, categoria, valor, data, status);
                showToast('✅ Transação atualizada!', 'success');
            } else {
                await api.criarTransacao(state.user, tipo, categoria, valor, data, status);
                showToast('✅ Transação criada!', 'success');
            }
            modal.remove();
            await loadDashboardData();
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };
};

function showInstallInstructionsModal(titulo, texto) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:380px;">
            <div class="modal-header">
                <h2>📲 ${titulo}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p style="color:var(--text-secondary);line-height:1.6;">${texto}</p>
            <button class="btn-primary mt-lg" style="width:100%;" onclick="this.closest('.modal-overlay').remove()">Entendi</button>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

// ========================================
// INSTALAÇÃO DA PWA
// ========================================
window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.hidden = true;
    showToast('App instalado com sucesso! 🎉', 'success');
});

// ========================================
// INICIALIZAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('nexus_theme') || 'light';
    setTheme(theme);

    const user = localStorage.getItem(STORAGE_KEY);
    const userName = localStorage.getItem(USER_NAME_KEY);
    const userFull = localStorage.getItem(USER_FULL_KEY);
    const userFoto = localStorage.getItem(USER_FOTO_KEY);
    
    if (user) {
        state.user = user;
        state.userName = userName || 'Usuário';
        state.userFullName = userFull || userName || 'Usuário';
        state.userFoto = userFoto || null;
    }

    document.getElementById('menu-toggle')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        // No celular a barra desliza por cima (abre/fecha); no desktop/tablet
        // ela só encolhe até mostrar os ícones, sem sumir da tela.
        if (window.matchMedia('(max-width: 768px)').matches) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    // Fecha o menu lateral ao tocar fora dele (no fundo escurecido) no celular.
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menu-toggle');
        if (!sidebar || !sidebar.classList.contains('open')) return;
        if (sidebar.contains(e.target) || e.target === menuToggle) return;
        sidebar.classList.remove('open');
    });

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
    });

    document.getElementById('sidebar-logout')?.addEventListener('click', doLogout);

    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        const jaInstalado = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (jaInstalado) {
            installBtn.hidden = true;
        }
        installBtn.addEventListener('click', async () => {
            if (deferredInstallPrompt) {
                installBtn.hidden = true;
                deferredInstallPrompt.prompt();
                const { outcome } = await deferredInstallPrompt.userChoice;
                if (outcome !== 'accepted') installBtn.hidden = false;
                deferredInstallPrompt = null;
                return;
            }
            const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
            if (isIOS) {
                showInstallInstructionsModal(
                    'Instalar no iPhone/iPad',
                    'Toque no ícone de compartilhar 📤 na barra do Safari e depois em "Adicionar à Tela de Início".'
                );
            } else {
                showInstallInstructionsModal(
                    'Instalar o app',
                    'Abra o menu do navegador (⋮ ou ...) e escolha "Instalar app" ou "Adicionar à tela inicial".'
                );
            }
        });
    }

    document.querySelectorAll('#sidebar .nav-item[href]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const view = el.getAttribute('href').replace('#/', '');
            navigate(view);
        });
    });

    window.addEventListener('hashchange', handleHashChange);

    if (checkSession()) {
        loadDashboardData();
    } else {
        navigate('login');
    }
});
