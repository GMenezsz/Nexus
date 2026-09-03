// ========================================
// NEXUS - SISTEMA COMPLETO
// ========================================

const API_BASE = 'https://nexus-api-mz3t.onrender.com';
const STORAGE_KEY = 'nexus_user';
const USER_NAME_KEY = 'nexus_user_name';
const USER_FULL_KEY = 'nexus_user_full';

// ========================================
// ESTADO GLOBAL
// ========================================
const state = {
    user: null,
    userName: null,
    userFullName: null,
    currentView: 'dashboard',
    theme: localStorage.getItem('nexus_theme') || 'light',
    transactions: [],
    metas: [],
    resumo: null,
    categories: { receita: [], despesa: [] }
};

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
    }
};

// ========================================
// HELPERS
// ========================================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
function navigate(view) {
    state.currentView = view;
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
    
    if (!user) return false;
    
    state.user = user;
    state.userName = userName || 'Usuário';
    state.userFullName = userFull || userName || 'Usuário';
    
    // Atualiza o header
    updateHeaderUser();
    
    return true;
}

function updateHeaderUser() {
    const userEl = document.getElementById('header-user');
    const userNameEl = document.getElementById('header-user-name');
    const loginLink = document.getElementById('header-login-link');
    
    if (state.user && state.userName) {
        loginLink.style.display = 'none';
        userEl.style.display = 'flex';
        userEl.style.alignItems = 'center';
        userEl.style.gap = '8px';
        userNameEl.textContent = `👋 ${state.userName}`;
    } else {
        loginLink.style.display = 'inline';
        userEl.style.display = 'none';
    }
}

function doLogin(user, nomeCompleto) {
    state.user = user;
    state.userFullName = nomeCompleto;
    state.userName = nomeCompleto.split(' ')[0];
    
    // Salva no localStorage
    localStorage.setItem(STORAGE_KEY, user);
    localStorage.setItem(USER_NAME_KEY, state.userName);
    localStorage.setItem(USER_FULL_KEY, state.userFullName);
    
    updateHeaderUser();
    navigate('dashboard');
    loadDashboardData();
}

function doLogout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_FULL_KEY);
    
    state.user = null;
    state.userName = null;
    state.userFullName = null;
    
    updateHeaderUser();
    navigate('login');
}

// ========================================
// LOADERS
// ========================================
async function loadDashboardData() {
    if (!state.user) return;
    try {
        state.resumo = await api.getResumo(state.user);
        state.transactions = await api.listarTransacoes(state.user);
        state.categories = await api.listarCategorias();
        state.metas = await api.listarMetas(state.user);
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

    switch (view) {
        case 'login': container.innerHTML = renderLogin(); break;
        case 'dashboard': container.innerHTML = renderDashboard(); break;
        case 'transacoes': container.innerHTML = renderTransacoes(); break;
        case 'planejamento': container.innerHTML = renderPlanejamento(); break;
        case 'relatorios': container.innerHTML = renderRelatorios(); break;
        case 'configuracoes': container.innerHTML = renderConfiguracoes(); break;
        default: container.innerHTML = '<h2>Página não encontrada</h2>';
    }
    
    bindEvents(view);
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
                    <div class="avatar">${fullName ? fullName.charAt(0).toUpperCase() : '👤'}</div>
                    <span>${fullName}</span>
                </div>
            </div>

            <div class="card-grid">
                <div class="card stat-info">
                    <div class="card-title">💰 Saldo Atual</div>
                    <div class="card-value">${formatCurrency(saldo)}</div>
                </div>
                <div class="card stat-success">
                    <div class="card-title">📈 Receitas</div>
                    <div class="card-value">${formatCurrency(receitas)}</div>
                </div>
                <div class="card stat-danger">
                    <div class="card-title">📉 Despesas</div>
                    <div class="card-value">${formatCurrency(despesas)}</div>
                </div>
            </div>

            <div class="card">
                <h3>🎯 Planejamento</h3>
                ${state.metas && state.metas.length > 0 ? `
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                        <div><strong>${state.metas[0].titulo}</strong></div>
                        <div>💰 ${formatCurrency(state.metas[0].salario_liquido)}</div>
                        <div>🎯 ${state.metas[0].porcentagem_meta}%</div>
                        <button class="btn-secondary" onclick="navigate('planejamento')">Ver detalhes →</button>
                    </div>
                ` : `
                    <div style="margin-bottom:12px;">
                        <p style="color:var(--text-muted);margin-bottom:12px;">Opa! Você ainda não possui um planejamento definido para este mês.</p>
                        <button class="btn-primary" onclick="navigate('planejamento')">Definir meu planejamento</button>
                    </div>
                `}
            </div>
        </div>
    `;
}

// ========================================
// RENDER: TRANSAÇÕES
// ========================================
function renderTransacoes() {
    const saldo = state.resumo?.saldo || 0;
    const receitas = state.resumo?.receitas || 0;
    const despesas = state.resumo?.despesas || 0;
    const transacoes = state.transactions || [];

    return `
        <div class="view">
            <div class="page-header">
                <h1>💳 Transações</h1>
                <button class="btn-primary" onclick="openTransactionModal()">+ Nova Transação</button>
            </div>

            <div class="card-grid">
                <div class="card stat-info">
                    <div class="card-title">💰 Saldo</div>
                    <div class="card-value">${formatCurrency(saldo)}</div>
                </div>
                <div class="card stat-success">
                    <div class="card-title">📈 Receitas</div>
                    <div class="card-value">${formatCurrency(receitas)}</div>
                </div>
                <div class="card stat-danger">
                    <div class="card-title">📉 Despesas</div>
                    <div class="card-value">${formatCurrency(despesas)}</div>
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <button id="bulk-delete-btn" class="btn-danger-strong" onclick="bulkDelete()">🗑️ Deletar Selecionados</button>
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
                            <th style="text-align:center;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transacoes.length === 0 ? `
                            <tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhuma transação encontrada</td></tr>
                        ` : transacoes.map(tx => {
                            const isPast = isDatePastOrToday(tx.data);
                            const statusText = isPast ? '✅ Efetuada' : '⏳ Pendente';
                            const statusClass = isPast ? 'badge-success' : 'badge-warning';
                            return `
                                <tr>
                                    <td><input type="checkbox" class="row-select" data-id="${tx.id}" onchange="updateBulkDeleteButton()" /></td>
                                    <td>${tx.categoria}</td>
                                    <td style="color:${tx.tipo === 'receita' ? 'var(--color-success)' : 'var(--color-danger)'};">${formatCurrency(tx.valor)}</td>
                                    <td>${formatDateBR(tx.data)}</td>
                                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                                    <td style="text-align:center;">
                                        <button class="action-dots" onclick="showTransactionActions('${tx.id}')">⋮</button>
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
function renderPlanejamento() {
    const meta = state.metas && state.metas.length > 0 ? state.metas[0] : null;
    const metaTotal = meta ? meta.salario_liquido * (meta.porcentagem_meta / 100) : 0;

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
                    ${meta ? `<button type="button" class="btn-danger" onclick="deleteMeta('${meta.titulo}')" style="margin-left:8px;">🗑️ Deletar</button>` : ''}
                </form>
            </div>

            ${meta ? `
                <div class="card">
                    <h3>📊 Resumo da Meta</h3>
                    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;">
                        <div><strong>Meta Total:</strong> ${formatCurrency(metaTotal)}</div>
                        <div><strong>Porcentagem:</strong> ${meta.porcentagem_meta}%</div>
                        <div><strong>Salário:</strong> ${formatCurrency(meta.salario_liquido)}</div>
                    </div>
                    <div style="background:var(--bg-input);border-radius:12px;padding:16px;text-align:center;color:var(--text-muted);margin-bottom:12px;">
                        🎯 Clique nos quadradinhos para marcar como concluído
                    </div>
                    <div class="cofrinho-grid">
                        ${Array.from({length: 12}, (_, i) => `
                            <div class="cofrinho-cell" data-index="${i}" onclick="toggleCofrinho(this)">${i + 1}</div>
                        `).join('')}
                    </div>
                </div>
            ` : `
                <div class="card">
                    <div style="margin-bottom:12px;">
                        <p style="color:var(--text-muted);margin-bottom:12px;">Opa! Você ainda não possui um planejamento definido para este mês.</p>
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
    return `
        <div class="view">
            <h1>📈 Relatórios</h1>
            <div class="card">
                <h3>📊 Resumo Geral</h3>
                <p style="color:var(--text-muted);">Em breve: Gráficos e análises detalhadas</p>
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
                <h3>👤 Perfil</h3>
                <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                    <div class="avatar-large">${state.userFullName ? state.userFullName.charAt(0).toUpperCase() : '👤'}</div>
                    <div>
                        <div><strong>Nome:</strong> ${state.userFullName || ''}</div>
                        <div><strong>Usuário:</strong> ${state.user || ''}</div>
                    </div>
                </div>
                <button class="btn-secondary" onclick="updateProfile()" style="margin-top:12px;">✏️ Editar Nome</button>
            </div>

            <div class="card">
                <h3>🔐 Alterar Senha</h3>
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
                <h3>🎨 Tema</h3>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary" onclick="setTheme('light')">☀️ Claro</button>
                    <button class="btn-secondary" onclick="setTheme('dark')">🌙 Escuro</button>
                </div>
            </div>

            <div class="card" style="border-color:var(--color-danger);">
                <h3 style="color:var(--color-danger);">⚠️ Ações de Conta</h3>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn-danger" onclick="resetAccount()">🔄 Resetar Conta</button>
                    <button class="btn-danger" onclick="deleteAccount()">🗑️ Excluir Conta</button>
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
    // Login/Register tabs
    document.querySelectorAll('.login-tabs button').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.login-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const isLogin = btn.dataset.tab === 'login';
            document.getElementById('login-form-container').style.display = isLogin ? 'block' : 'none';
            document.getElementById('register-form-container').style.display = isLogin ? 'none' : 'block';
        };
    });

    // Login form
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
                    doLogin(user, result.nome);
                    showToast(result.boas_vindas || `Bem-vindo, ${result.nome}!`, 'success');
                }
            } catch (err) {
                showToast('Erro: ' + (err.message || 'Falha no login'), 'error');
            }
        };
    }

    // Register form
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

    // Meta form
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

    // Change password form
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

window.toggleCofrinho = (el) => {
    el.classList.toggle('completed');
};

window.showTransactionActions = (id) => {
    const action = confirm(`O que deseja fazer com esta transação?\n\nOK = Editar\nCancelar = Deletar`);
    if (action) {
        editTransaction(id);
    } else {
        deleteTransaction(id);
    }
};

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
            btn.textContent = `🗑️ Deletar ${checked} Selecionado${checked > 1 ? 's' : ''}`;
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
    if (!confirm(`Deletar ${selected.length} transação(ões)?`)) return;
    
    let deleted = 0;
    for (const cb of selected) {
        try {
            await api.deletarTransacao(state.user, cb.dataset.id);
            deleted++;
        } catch (e) { /* ignora */ }
    }
    showToast(`${deleted} transações deletadas!`, 'success');
    await loadDashboardData();
};

window.editTransaction = async (id) => {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    
    const novoTipo = prompt('Tipo (receita/despesa):', tx.tipo);
    if (!novoTipo) return;
    
    const novaCategoria = prompt('Categoria:', tx.categoria);
    if (!novaCategoria) return;
    
    const novoValor = prompt('Valor (ex: 100.50):', tx.valor);
    if (!novoValor) return;
    
    const novaData = prompt('Data (DD/MM/AAAA):', formatDateBR(tx.data));
    if (!novaData) return;
    
    const novoStatus = confirm('Status: OK = Efetuada, Cancelar = Pendente') ? 'efetuada' : 'pendente';
    
    try {
        await api.atualizarTransacao(
            state.user,
            id,
            novoTipo,
            novaCategoria,
            parseFloat(novoValor),
            toAPIFormat(novaData),
            novoStatus
        );
        showToast('Transação atualizada!', 'success');
        await loadDashboardData();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
};

window.deleteTransaction = async (id) => {
    if (!confirm('Deletar esta transação?')) return;
    try {
        await api.deletarTransacao(state.user, id);
        showToast('Transação deletada!', 'success');
        await loadDashboardData();
    } catch (err) {
        showToast('Erro: ' + (err.message || ''), 'error');
    }
};

window.deleteMeta = async (titulo) => {
    if (!confirm(`Deletar meta "${titulo}"?`)) return;
    try {
        await api.deletarMeta(state.user, titulo);
        showToast('Meta deletada!', 'success');
        await loadDashboardData();
    } catch (err) {
        showToast('Erro: ' + (err.message || ''), 'error');
    }
};

window.updateProfile = async () => {
    const nome = prompt('Novo nome:', state.userFullName?.split(' ')[0] || '');
    const sobrenome = prompt('Novo sobrenome:', state.userFullName?.split(' ').slice(1).join(' ') || '');
    if (nome === null || sobrenome === null) return;
    try {
        await api.atualizarNomeSobrenome(state.user, nome, sobrenome);
        state.userFullName = `${nome} ${sobrenome}`.trim();
        state.userName = nome;
        
        // Atualiza localStorage
        localStorage.setItem(USER_NAME_KEY, state.userName);
        localStorage.setItem(USER_FULL_KEY, state.userFullName);
        
        showToast('Perfil atualizado!', 'success');
        updateHeaderUser();
        renderView('configuracoes');
    } catch (err) {
        showToast('Erro: ' + (err.message || ''), 'error');
    }
};

window.resetAccount = async () => {
    if (!confirm('Resetar sua conta? Todos os dados serão apagados.')) return;
    try {
        await api.reiniciarConta(state.user);
        showToast('Conta resetada!', 'success');
        doLogout();
    } catch (err) {
        showToast('Erro: ' + (err.message || ''), 'error');
    }
};

window.deleteAccount = async () => {
    if (!confirm('EXCLUIR sua conta permanentemente? Esta ação é irreversível!')) return;
    try {
        await api.deletarUsuario(state.user);
        showToast('Conta excluída!', 'success');
        doLogout();
    } catch (err) {
        showToast('Erro: ' + (err.message || ''), 'error');
    }
};

window.openTransactionModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>➕ Nova Transação</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <form id="transaction-form">
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="tx-tipo" required>
                        <option value="receita">💰 Receita</option>
                        <option value="despesa">💸 Despesa</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Categoria</label>
                    <select id="tx-categoria" required>
                        <option value="Salário">Salário</option>
                        <option value="Pix">Pix</option>
                        <option value="Bonificação">Bonificação</option>
                        <option value="Freelance">Freelance</option>
                        <option value="Investimentos">Investimentos</option>
                        <option value="Alimentação">Alimentação</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Moradia">Moradia</option>
                        <option value="Lazer">Lazer</option>
                        <option value="Contas">Contas</option>
                        <option value="Saúde">Saúde</option>
                        <option value="Outros">Outros</option>
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
                    <label>Status</label>
                    <select id="tx-status">
                        <option value="efetuada">✅ Efetuada</option>
                        <option value="pendente">⏳ Pendente</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary" style="width:100%;">Criar Transação</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('tx-data').value = hoje;

    document.getElementById('transaction-form').onsubmit = async (e) => {
        e.preventDefault();
        const tipo = document.getElementById('tx-tipo').value;
        const categoria = document.getElementById('tx-categoria').value;
        const valor = unmaskCurrency(document.getElementById('tx-valor').value);
        const data = document.getElementById('tx-data').value;
        const status = document.getElementById('tx-status').value;

        if (!valor) { showToast('Digite um valor válido', 'error'); return; }

        try {
            await api.criarTransacao(state.user, tipo, categoria, valor, data, status);
            showToast('✅ Transação criada!', 'success');
            modal.remove();
            await loadDashboardData();
        } catch (err) {
            showToast('Erro: ' + err.message, 'error');
        }
    };
};

// ========================================
// INICIALIZAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Aplicar tema
    const theme = localStorage.getItem('nexus_theme') || 'light';
    setTheme(theme);

    // Recupera dados do usuário
    const user = localStorage.getItem(STORAGE_KEY);
    const userName = localStorage.getItem(USER_NAME_KEY);
    const userFull = localStorage.getItem(USER_FULL_KEY);
    
    if (user) {
        state.user = user;
        state.userName = userName || 'Usuário';
        state.userFullName = userFull || userName || 'Usuário';
        updateHeaderUser();
    }

    // Eventos do menu
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
    });

    document.getElementById('sidebar-logout')?.addEventListener('click', doLogout);

    // Navegação
    document.querySelectorAll('#sidebar .nav-item[href]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const view = el.getAttribute('href').replace('#/', '');
            navigate(view);
        });
    });

    // Router
    window.addEventListener('hashchange', handleHashChange);

    // Inicializar
    if (checkSession()) {
        loadDashboardData();
    } else {
        navigate('login');
    }
});
