// ========================================
// NEXUS - SISTEMA COMPLETO
// ========================================

console.log('🔵 SCRIPT CARREGADO - v10');

const API_BASE = 'https://nexus-api-teste.onrender.com';
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
    filterType: null,
    prevStats: { saldo: 0, receitas: 0, despesas: 0 }
};

// Guarda o evento de instalação da PWA até o usuário clicar no botão
let deferredInstallPrompt = null;

// Paleta de cores para os gráficos por categoria
const CHART_COLORS = ['#8b7fe8', '#4caf84', '#dc3545', '#f5b86e', '#6a8cff', '#e67ce6', '#4dd0c4', '#f2994a', '#9b59b6', '#2ecc71', '#c0392b', '#16a085', '#e84393', '#0984e3', '#fdcb6e', '#00b894', '#6c5ce7', '#d63031', '#0abde3', '#ff9f43'];
// Cor única para TODAS as categorias criadas pelo próprio usuário
// (diferente da paleta usada nas categorias fixas do sistema). Se adapta
// ao tema: branca no tema escuro, preta no tema claro.
function getCustomCategoryColor() {
    return state.theme === 'dark' ? '#ffffff' : '#000000';
}
const NOVA_CATEGORIA_VALUE = '__nova_categoria__';
const dashboardCharts = { receitas: null, despesas: null, balanco: null };
const relatoriosCharts = { receitas: null, despesas: null, balancoMeses: null };

// ========================================
// CORES DE CATEGORIA (nunca se repetem)
// Cada categoria — de receita ou de despesa — recebe sempre a mesma cor,
// e nenhuma categoria repete a cor de outra, mesmo que existam mais
// categorias do que cores na paleta base (nesse caso, cores extras são
// geradas distribuindo matizes ao redor do círculo de cores).
// ========================================
function generateDistinctColors(count) {
    if (count <= CHART_COLORS.length) return CHART_COLORS.slice(0, count);
    const colors = CHART_COLORS.slice();
    const extras = count - CHART_COLORS.length;
    for (let i = 0; i < extras; i++) {
        const hue = Math.round((360 / extras) * i);
        colors.push(`hsl(${hue}, 62%, 50%)`);
    }
    return colors;
}

// Monta (ou remonta) o mapa nome-da-categoria -> cor a partir de TODAS as
// categorias cadastradas (receitas + despesas juntas), garantindo que
// nenhuma cor se repita entre elas.
function buildCategoryColorMap() {
    const receitas = (state.categories && state.categories.receita) || [];
    const despesas = (state.categories && state.categories.despesa) || [];
    const personalizadas = (state.categories && state.categories.personalizadas) || { receita: [], despesa: [] };
    state.customCategoryNames = new Set([...(personalizadas.receita || []), ...(personalizadas.despesa || [])]);

    // As categorias personalizadas (criadas pelo usuário) NÃO entram na
    // distribuição da paleta — elas sempre usam a mesma cor única fixa,
    // diferente de tudo que já está em uso pelas categorias fixas.
    const todasCategorias = [...new Set([...receitas, ...despesas])]
        .filter(cat => !state.customCategoryNames.has(cat));
    const cores = generateDistinctColors(todasCategorias.length);
    const mapa = {};
    todasCategorias.forEach((cat, i) => { mapa[cat] = cores[i]; });
    state.categoryColors = mapa;
}

// Retorna a cor de uma categoria. Categorias criadas pelo usuário sempre
// recebem a mesma cor única (CUSTOM_CATEGORY_COLOR), para se diferenciarem
// visualmente das categorias fixas do sistema. Se uma categoria fixa ainda
// não estiver no mapa (ex: categoria antiga usada em transações passadas
// mas removida da lista atual), reserva uma cor nova que ainda não está em
// uso por ninguém.
function colorForCategoria(nome) {
    if (state.customCategoryNames && state.customCategoryNames.has(nome)) {
        return getCustomCategoryColor();
    }

    if (!state.categoryColors) state.categoryColors = {};
    if (state.categoryColors[nome]) return state.categoryColors[nome];

    const usadas = new Set(Object.values(state.categoryColors));
    usadas.add(getCustomCategoryColor());
    const candidatas = generateDistinctColors(usadas.size + CHART_COLORS.length);
    const nova = candidatas.find(c => !usadas.has(c)) || `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`;
    state.categoryColors[nome] = nova;
    return nova;
}

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
        const color = colors ? colors[i] : colorForCategoria(categoria);
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
    const colors = labels.map(cat => colorForCategoria(cat));
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

    async listarCategorias(usuario) {
        const query = usuario ? `?usuario=${encodeURIComponent(usuario)}` : '';
        return this.request(`/categorias${query}`);
    },

    async criarCategoria(usuario, tipo, nome) {
        return this.request('/categorias/criar', {
            method: 'POST',
            body: JSON.stringify({ usuario, tipo, nome })
        });
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

    async criarMeta(usuario, titulo, meta_total, anos) {
        return this.request('/metas/criar', {
            method: 'POST',
            body: JSON.stringify({ usuario, titulo, meta_total, anos })
        });
    },

    async atualizarMeta(usuario, titulo_antigo, titulo_novo, meta_total, anos) {
        return this.request('/metas/atualizar', {
            method: 'PUT',
            body: JSON.stringify({ usuario, titulo_antigo, titulo_novo, meta_total, anos })
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

// ========================================
// ANIMAÇÃO DE CONTADORES (saldo, receitas, despesas)
// Sobe ou desce suavemente do valor antigo até o novo, em vez de
// simplesmente trocar o texto na hora (o que causava o "piscar").
// ========================================
function animateCounter(el, from, to, duration = 900, formatFn = formatCurrency) {
    if (!el) return;
    const start = Number(from) || 0;
    const end = Number(to) || 0;
    if (start === end) {
        el.textContent = formatFn(end);
        return;
    }
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cúbico
        const current = start + (end - start) * eased;
        el.textContent = formatFn(current);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = formatFn(end);
        }
    }
    requestAnimationFrame(step);
}

function animateSummaryStats() {
    const resumo = resumoDoPeriodoSelecionado();
    const saldo = resumo.saldo || 0;
    const receitas = resumo.receitas || 0;
    const despesas = resumo.despesas || 0;
    const prev = state.prevStats || { saldo: 0, receitas: 0, despesas: 0 };

    animateCounter(document.getElementById('stat-saldo-value'), prev.saldo, saldo);
    animateCounter(document.getElementById('stat-receitas-value'), prev.receitas, receitas);
    animateCounter(document.getElementById('stat-despesas-value'), prev.despesas, despesas);

    state.prevStats = { saldo, receitas, despesas };
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
    state.prevStats = { saldo: 0, receitas: 0, despesas: 0 };
    
    navigate('login');
}

// ========================================
// LOADERS
// ========================================

// Verifica as transações pendentes cuja data já chegou (ou passou) e as
// efetiva automaticamente no servidor, trocando o status de "pendente"
// para "pago". Isso garante que saldo, receitas e despesas se atualizem
// sozinhos assim que o dia da transação chega, sem precisar editar nada
// manualmente.
async function efetuarTransacoesVencidas() {
    if (!state.user) return false;
    const hoje = new Date().toISOString().split('T')[0];
    const vencidas = (state.transactions || []).filter(t =>
        t && t.data && t.data <= hoje && t.status !== 'pago' && t.status !== 'efetuada'
    );
    if (vencidas.length === 0) return false;

    for (const t of vencidas) {
        try {
            await api.atualizarTransacao(state.user, t.id, t.tipo, t.categoria, t.valor, t.data, 'pago');
            t.status = 'pago';
        } catch (err) {
            console.error('Erro ao efetivar transação vencida:', t.id, err);
        }
    }
    return true;
}

async function loadDashboardData() {
    if (!state.user) return;
    ultimoPeriodoCarregado = periodoAtual();
    // Toda vez que os dados são recarregados (login, navegação ou o relógio
    // detectando que o dia/mês virou), o seletor de mês volta a apontar
    // sempre para o mês atual.
    state.selectedPeriod = { mes: periodoAtual().mes, ano: periodoAtual().ano };
    try {
        const transacoesResp = await api.listarTransacoes(state.user);
        state.transactions = transacoesResp?.transacoes || [];
        // Antes de calcular saldo/receitas/despesas, efetiva automaticamente
        // qualquer transação pendente cuja data já chegou.
        await efetuarTransacoesVencidas();
        state.resumo = resumoDoPeriodoSelecionado();
        state.categories = await api.listarCategorias(state.user);
        buildCategoryColorMap();
        const metasResp = await api.listarMetas(state.user);
        state.metas = (metasResp?.metas || []).map(m => ({
            ...m,
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
            animateSummaryStats();
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    renderDashboardCharts();
                } else {
                    checkChartJs();
                }
            }, 50);
            break;
        case 'transacoes': container.innerHTML = renderTransacoes(); animateSummaryStats(); break;
        case 'receitas': container.innerHTML = renderTransacoes(); animateSummaryStats(); break;
        case 'despesas': container.innerHTML = renderTransacoes(); animateSummaryStats(); break;
        case 'planejamento': container.innerHTML = renderPlanejamento(); break;
        case 'relatorios': 
            container.innerHTML = renderRelatorios(); 
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    renderRelatoriosCharts();
                } else {
                    checkChartJs();
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
            <h1> Nexus</h1>
            <p class="sub">Entre ou crie sua conta</p>
            <div class="login-tabs">
                <button class="active" data-tab="login">Entrar</button>
                <button data-tab="register">Cadastrar</button>
            </div>
            <div id="login-form-container">
                <form id="login-form" autocomplete="off">
                    <div class="form-group">
                        <label>Usuário</label>
                        <input type="text" id="login-user" name="login-user-field" placeholder="seu_usuario" autocomplete="off" data-lpignore="true" required />
                    </div>
                    <div class="form-group">
                        <label>Senha</label>
                        <input type="password" id="login-pass" name="login-pass-field" placeholder="••••••••" autocomplete="new-password" data-lpignore="true" required />
                    </div>
                    <div class="forgot-password-link">
                        <a href="#" id="forgot-password-link">Esqueceu sua senha?</a>
                    </div>
                    <button type="submit" class="btn-primary">Entrar</button>
                </form>
            </div>
            <div id="register-form-container" style="display:none;">
                <form id="register-form" autocomplete="off">
                    <div class="form-group">
                        <label>Nome</label>
                        <input type="text" id="reg-nome" name="reg-nome-field" placeholder="João" autocomplete="off" required />
                    </div>
                    <div class="form-group">
                        <label>Sobrenome</label>
                        <input type="text" id="reg-sobrenome" name="reg-sobrenome-field" placeholder="Silva" autocomplete="off" required />
                    </div>
                    <div class="form-group">
                        <label>Usuário</label>
                        <input type="text" id="reg-user" name="reg-user-field" placeholder="seu_usuario" autocomplete="off" data-lpignore="true" required />
                    </div>
                    <div class="form-group">
                        <label>Senha</label>
                        <input type="password" id="reg-pass" name="reg-pass-field" placeholder="••••••••" autocomplete="new-password" data-lpignore="true" required />
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
    const resumo = resumoDoPeriodoSelecionado();
    const saldo = resumo.saldo || 0;
    const receitas = resumo.receitas || 0;
    const despesas = resumo.despesas || 0;
    const nome = state.userName || 'Usuário';
    const fullName = state.userFullName || 'Usuário';
    const prev = state.prevStats || { saldo: 0, receitas: 0, despesas: 0 };

    return `
        <div class="view dashboard-view">
            <div class="dashboard-header">
                <h1> Olá, ${nome}</h1>
                <div class="user-profile" onclick="navigate('configuracoes')">
                    ${renderAvatar('normal')}
                    <span>${fullName}</span>
                </div>
            </div>

            ${renderSeletorMes()}

            <div class="card-grid">
                <div class="card stat-info" style="cursor:pointer;" onclick="navigate('transacoes')">
                    <div class="card-title">💰 Saldo Atual</div>
                    <div class="card-value" id="stat-saldo-value">${formatCurrency(prev.saldo)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">Clique para ver todas</div>
                </div>
                <div class="card stat-success" style="cursor:pointer;" onclick="navigate('receitas')">
                    <div class="card-title">📈 Receitas</div>
                    <div class="card-value" id="stat-receitas-value">${formatCurrency(prev.receitas)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">Clique para ver receitas</div>
                </div>
                <div class="card stat-danger" style="cursor:pointer;" onclick="navigate('despesas')">
                    <div class="card-title">📉 Despesas</div>
                    <div class="card-value" id="stat-despesas-value">${formatCurrency(prev.despesas)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">Clique para ver despesas</div>
                </div>
            </div>

            <div class="card-grid-2">
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h3>Receitas por Categoria</h3>
                        <button class="btn-ver-mais" onclick="navigate('relatorios')">Ver mais</button>
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
                        <button class="btn-ver-mais" onclick="navigate('relatorios')">Ver mais</button>
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
                        <button class="btn-ver-mais" onclick="navigate('relatorios')">Ver mais</button>
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
                <h3 class="mb-md">Planejamento</h3>
                ${state.metas && state.metas.length > 0 ? `
                    ${state.metas.map((meta, idx) => `
                        <div${idx > 0 ? ' style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border-color);"' : ''}>
                            <div class="row-between">
                                <div><strong>${meta.titulo}</strong></div>
                                <div>
                                    <div style="font-size:0.7rem;color:var(--text-muted);">Meta Total</div>
                                    <strong>${formatCurrency(meta.meta_total)}</strong>
                                </div>
                                <div>
                                    <div style="font-size:0.7rem;color:var(--text-muted);">Prazo</div>
                                    <strong>${meta.anos} ano${meta.anos > 1 ? 's' : ''}</strong>
                                </div>
                            </div>
                            ${renderMetaMiniPreview(meta)}
                        </div>
                    `).join('')}
                    <button class="btn-secondary" style="width:100%;margin-top:20px;" onclick="navigate('planejamento')">Ver detalhes →</button>
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

// ========================================
// FILTRO DE MÊS (mês atual + últimos 6 meses)
// Por padrão, gráficos, saldo/receitas/despesas e a lista de transações
// mostram o mês corrente. A pessoa pode escolher qualquer um dos 6 meses
// anteriores no seletor — quando isso acontece, o site inteiro (dashboard,
// transações, receitas, despesas) se atualiza com os valores salvos
// daquele mês. Nada é apagado: os meses anteriores continuam guardados.
// Sempre que o site recarrega os dados (login, navegação, ou quando o
// relógio detecta que o mês/dia virou) o seletor volta para o mês atual.
// ========================================
function periodoAtual() {
    const hoje = new Date();
    return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear(), dia: hoje.getDate() };
}

// Lista as opções de mês disponíveis no seletor: o mês atual + os 6
// anteriores (7 opções no total), da mais recente para a mais antiga.
function opcoesDeMeses() {
    const hoje = new Date();
    const opcoes = [];
    for (let i = 0; i <= 6; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        opcoes.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
    }
    return opcoes;
}

// Nomes dos meses por extenso, usados no lugar de toLocaleString para
// garantir sempre o formato "Mês Ano" (ex: "Setembro 2026"), sem a
// partícula "de" que o pt-BR do navegador costuma inserir.
const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NOMES_MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function nomeDoMes(mes, ano) {
    const nome = NOMES_MESES[mes - 1] || '';
    const capitalizado = nome.charAt(0).toUpperCase() + nome.slice(1);
    return `${capitalizado} ${ano}`;
}

function nomeMesAbreviado(mes, ano) {
    return NOMES_MESES_ABREV[mes - 1] || '';
}

function periodoSelecionado() {
    return state.selectedPeriod || periodoAtual();
}

function transacoesDoPeriodoSelecionado() {
    const { mes, ano } = periodoSelecionado();
    return (state.transactions || []).filter(t => {
        if (!t || !t.data) return false;
        const [anoTx, mesTx] = t.data.split('-').map(Number);
        return anoTx === ano && mesTx === mes;
    });
}

function calcularResumoPeriodo(mes, ano) {
    let saldo = 0, receitas = 0, despesas = 0;
    (state.transactions || []).forEach(t => {
        if (!t || !t.data) return;
        const [anoTx, mesTx] = t.data.split('-').map(Number);
        if (anoTx !== ano || mesTx !== mes) return;
        if (t.status !== 'pago' && t.status !== 'efetuada') return;
        const valor = Number(t.valor);
        if (t.tipo === 'receita') { saldo += valor; receitas += valor; }
        else if (t.tipo === 'despesa') { saldo -= valor; despesas += valor; }
    });
    return { saldo, receitas, despesas };
}

function resumoDoPeriodoSelecionado() {
    const { mes, ano } = periodoSelecionado();
    return calcularResumoPeriodo(mes, ano);
}

function groupByCategoria(tipo) {
    const totals = {};
    transacoesDoPeriodoSelecionado()
        .filter(t => t.tipo === tipo && (t.status === 'pago' || t.status === 'efetuada'))
        .forEach(t => { totals[t.categoria] = (totals[t.categoria] || 0) + Number(t.valor); });
    return totals;
}

// Lista os últimos N meses (do mais antigo para o mais recente, terminando
// no mês atual). Usado no card "Balanço dos Últimos Meses" de Relatórios.
function ultimosNMeses(n) {
    const hoje = new Date();
    const meses = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        meses.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
    }
    return meses;
}

// Seletor de mês usado no Dashboard e em Transações/Receitas/Despesas/Relatórios.
function renderSeletorMes() {
    const opcoes = opcoesDeMeses();
    const selecionado = periodoSelecionado();
    return `
        <div class="mes-seletor">
            <select id="seletor-mes-periodo" class="mes-seletor-select" onchange="window.selecionarMesPeriodo(this.value)">
                ${opcoes.map(o => {
                    const value = `${o.ano}-${String(o.mes).padStart(2, '0')}`;
                    const isSel = o.mes === selecionado.mes && o.ano === selecionado.ano;
                    return `<option value="${value}" ${isSel ? 'selected' : ''}>${nomeDoMes(o.mes, o.ano)}</option>`;
                }).join('')}
            </select>
        </div>
    `;
}

window.selecionarMesPeriodo = (value) => {
    const [ano, mes] = value.split('-').map(Number);
    state.selectedPeriod = { mes, ano };
    state.prevStats = resumoDoPeriodoSelecionado();
    renderView(state.currentView);
};

// Fica de olho no relógio: se o mês/dia mudou desde o último carregamento,
// recarrega os dados automaticamente (saldo, receitas, despesas e gráficos
// voltam a considerar o mês atual, zerado, sem perder o histórico) e o
// seletor de mês volta a apontar para o mês corrente. Também é aqui que
// transações pendentes cuja data chegou são efetivadas (via loadDashboardData
// -> efetuarTransacoesVencidas).
let ultimoPeriodoCarregado = null;
function verificarMudancaDeMes() {
    if (!state.user) return;
    const atual = periodoAtual();
    // Recarrega quando o dia muda (para efetivar transações pendentes que
    // acabaram de vencer) e, claro, sempre que o mês/ano muda.
    const mudou = ultimoPeriodoCarregado && (
        ultimoPeriodoCarregado.dia !== atual.dia ||
        ultimoPeriodoCarregado.mes !== atual.mes ||
        ultimoPeriodoCarregado.ano !== atual.ano
    );
    if (mudou) {
        ultimoPeriodoCarregado = atual;
        loadDashboardData();
        return;
    }
    ultimoPeriodoCarregado = atual;
}

// Verifica periodicamente (sem esperar o dia virar) se alguma transação já
// carregada ficou vencida (data <= hoje) e ainda está pendente, efetivando-a
// e atualizando a tela na hora — cobre o caso de o app ficar aberto no
// exato dia em que a transação pendente deveria virar paga.
async function verificarTransacoesVencidasEmSegundoPlano() {
    if (!state.user) return;
    const mudou = await efetuarTransacoesVencidas();
    if (mudou) {
        state.prevStats = resumoDoPeriodoSelecionado();
        renderView(state.currentView);
    }
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

    const colors = labels.map(cat => colorForCategoria(cat));

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

// Gráfico de barras verticais com o balanço dos últimos 6 meses: verde para
// receitas, vermelho para despesas. Meses sem nenhum valor lançado ficam
// naturalmente sem barra (altura 0). É redesenhado toda vez que a tela de
// Relatórios é renderizada, então qualquer transação nova (criada, editada
// ou excluída) atualiza o gráfico automaticamente.
function renderGraficoBalancoMeses() {
    const canvas = document.getElementById('chart-balanco-meses');
    if (!canvas) return;

    if (relatoriosCharts.balancoMeses) {
        relatoriosCharts.balancoMeses.destroy();
        relatoriosCharts.balancoMeses = null;
    }

    if (typeof Chart === 'undefined') return;

    const meses = ultimosNMeses(6);
    const labels = meses.map(({ mes, ano }) => nomeMesAbreviado(mes, ano));
    const receitasData = meses.map(({ mes, ano }) => calcularResumoPeriodo(mes, ano).receitas);
    const despesasData = meses.map(({ mes, ano }) => calcularResumoPeriodo(mes, ano).despesas);

    relatoriosCharts.balancoMeses = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Receitas',
                    data: receitasData,
                    backgroundColor: '#4caf84',
                    borderRadius: 20,
                    borderSkipped: false,
                    maxBarThickness: 26
                },
                {
                    label: 'Despesas',
                    data: despesasData,
                    backgroundColor: '#dc3545',
                    borderRadius: 20,
                    borderSkipped: false,
                    maxBarThickness: 26
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => formatCurrency(v) }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
                    }
                }
            }
        }
    });
}

function renderRelatoriosCharts() {
    const receitasTotals = groupByCategoria('receita');
    const despesasTotals = groupByCategoria('despesa');
    
    renderDoughnutChart('chart-rel-receitas', 'legend-rel-receitas', receitasTotals, 'receitas', relatoriosCharts);
    renderDoughnutChart('chart-rel-despesas', 'legend-rel-despesas', despesasTotals, 'despesas', relatoriosCharts);
    renderGraficoBalancoMeses();
}

// ========================================
// RENDER: TRANSAÇÕES
// ========================================
function renderTransacoes() {
    const resumo = resumoDoPeriodoSelecionado();
    const saldo = resumo.saldo || 0;
    const receitas = resumo.receitas || 0;
    const despesas = resumo.despesas || 0;
    const prev = state.prevStats || { saldo: 0, receitas: 0, despesas: 0 };
    
    let transacoes = transacoesDoPeriodoSelecionado();
    
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
            ${renderSeletorMes()}

            <div class="card-grid">
                <div class="card stat-info" style="cursor:pointer;" onclick="navigate('transacoes')">
                    <div class="card-title">💰 Saldo</div>
                    <div class="card-value" id="stat-saldo-value">${formatCurrency(prev.saldo)}</div>
                </div>
                <div class="card stat-success" style="cursor:pointer;" onclick="navigate('receitas')">
                    <div class="card-title">📈 Receitas</div>
                    <div class="card-value" id="stat-receitas-value">${formatCurrency(prev.receitas)}</div>
                </div>
                <div class="card stat-danger" style="cursor:pointer;" onclick="navigate('despesas')">
                    <div class="card-title">📉 Despesas</div>
                    <div class="card-value" id="stat-despesas-value">${formatCurrency(prev.despesas)}</div>
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

// Preview compacto usado no card de Planejamento do Dashboard: mostra até
// 10 quadradinhos (marcados/não marcados), com o valor de cada parcela
// dentro, e "..." se houver mais parcelas do que o limite exibido.
function renderMetaMiniPreview(meta) {
    const totalParcelas = meta.total_parcelas || (meta.anos * 12);
    const valorParcela = meta.valor_parcela ?? (meta.meta_total / totalParcelas);
    const parcelasConcluidas = meta.parcelas || [];
    const limite = Math.min(10, totalParcelas);

    const cells = Array.from({length: limite}, (_, i) => {
        const concluida = parcelasConcluidas.includes(i);
        return `<div class="cofrinho-mini-cell${concluida ? ' completed' : ''}">${formatCompactCurrency(valorParcela)}</div>`;
    }).join('');

    const temMais = totalParcelas > limite;

    return `
        <div class="cofrinho-mini-grid">
            ${cells}
            ${temMais ? `<span class="cofrinho-mini-more">...</span>` : ''}
        </div>
    `;
}

// Renderiza o card de uma meta específica: resumo + "cofrinho" com uma
// parcela mensal para cada mês dentro do prazo (anos * 12).
function renderMetaCard(meta) {
    const totalParcelas = meta.total_parcelas || (meta.anos * 12);
    const valorParcela = meta.valor_parcela ?? (meta.meta_total / totalParcelas);
    const parcelasConcluidas = meta.parcelas || [];
    const valorAtual = parcelasConcluidas.length * valorParcela;
    const progresso = meta.meta_total > 0 ? Math.min(100, (valorAtual / meta.meta_total) * 100) : 0;

    return `
        <div class="card">
            <div class="row-between mb-md">
                <h3 style="margin:0;">${meta.titulo}</h3>
                <div style="display:flex;gap:8px;">
                    <button type="button" class="btn-secondary" onclick="editMeta('${meta.titulo}')">Editar</button>
                    <button type="button" class="btn-danger" onclick="deleteMeta('${meta.titulo}')">Excluir</button>
                </div>
            </div>
            <div class="summary-list mb-md">
                <div><strong>Valor Guardado:</strong> <span style="color:var(--color-success);font-weight:700;">${formatCurrency(valorAtual)}</span></div>
                <div><strong>Meta Total:</strong> ${formatCurrency(meta.meta_total)}</div>
                <div><strong>Prazo:</strong> ${meta.anos} ano${meta.anos > 1 ? 's' : ''} (${totalParcelas} parcelas mensais)</div>
                <div><strong>Valor por Mês:</strong> ${formatCurrency(valorParcela)}</div>
                <div><strong>Progresso:</strong> ${progresso.toFixed(1)}%</div>
            </div>
            <div class="text-center text-muted mb-md" style="background:var(--bg-input);border-radius:12px;padding:16px;">
                🎯 Clique nos quadradinhos para marcar ou desmarcar uma parcela como guardada.
            </div>
            <div class="cofrinho-grid">
                ${Array.from({length: totalParcelas}, (_, i) => {
                    const concluida = parcelasConcluidas.includes(i);
                    return `
                        <div class="cofrinho-cell${concluida ? ' completed' : ''}"
                             data-index="${i}"
                             data-titulo="${meta.titulo}"
                             onclick="toggleCofrinho(this)"
                             title="${concluida ? `Guardado — clique para desmarcar` : `Marcar ${formatCurrency(valorParcela)} como guardado`}">
                            ${formatCompactCurrency(valorParcela)}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderPlanejamento() {
    const metas = state.metas || [];

    return `
        <div class="view">
            <h1>Planejamento</h1>

            <div class="card">
                <h3>Nova Meta</h3>
                <form id="meta-form">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" id="meta-titulo" placeholder="Ex: Viagem" required />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Valor da Meta</label>
                            <input type="text" id="meta-valor" placeholder="R$ 0,00" oninput="maskCurrency(this)" required />
                        </div>
                        <div class="form-group">
                            <label>Em quantos anos?</label>
                            <input type="number" id="meta-anos" placeholder="Ex: 1" min="1" max="40" required />
                        </div>
                    </div>
                    <button type="submit" class="btn-primary">Criar Meta</button>
                </form>
            </div>

            ${metas.length > 0
                ? metas.map(meta => renderMetaCard(meta)).join('')
                : `
                    <div class="card">
                        <div class="empty-state">
                            <p>Opa! Você ainda não possui nenhuma meta definida.</p>
                        </div>
                    </div>
                `
            }
        </div>
    `;
}

// ========================================
// RENDER: RELATÓRIOS
// ========================================
function renderRelatorios() {
    const resumo = resumoDoPeriodoSelecionado();
    const receitas = resumo.receitas || 0;
    const despesas = resumo.despesas || 0;
    const balanco = receitas - despesas;
    
    const { mes, ano } = periodoSelecionado();
    const mesCapitalizado = nomeDoMes(mes, ano);

    // Lista dos últimos 6 meses com o total de receitas e despesas de cada
    // um — mostrada ao lado do gráfico de barras verticais.
    function renderBalancoUltimosMeses() {
        const meses = ultimosNMeses(6);
        return meses.map(({ mes: m, ano: a }) => {
            const r = calcularResumoPeriodo(m, a);
            return `
                <div class="balanco-mes-item">
                    <div class="balanco-mes-titulo">${nomeDoMes(m, a)}</div>
                    <div class="balanco-mes-linha"><span>Receita</span><span>${formatCurrency(r.receitas)}</span></div>
                    <div class="balanco-mes-linha"><span>Despesa</span><span>${formatCurrency(r.despesas)}</span></div>
                </div>
            `;
        }).join('');
    }
    
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
            <h1>Relatórios</h1>

            ${renderSeletorMes()}
            
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h3>${mesCapitalizado}</h3>
                </div>
                
                <h4 style="margin-bottom:12px;color:var(--text-secondary);font-weight:500;">Balanço Mensal</h4>
                ${renderBalancoMensal()}
            </div>

            <div class="card" style="margin-top:24px;">
                <h3 class="mb-md">Balanço dos Últimos Meses</h3>
                <div class="balanco-meses-wrap">
                    <div class="balanco-meses-chart">
                        <canvas id="chart-balanco-meses"></canvas>
                    </div>
                    <div class="balanco-meses-lista">
                        ${renderBalancoUltimosMeses()}
                    </div>
                </div>
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
const INVITE_LINK = 'https://nexus-finance-lemon.vercel.app';

function renderConfiguracoes() {
    return `
        <div class="view">
            <h1>⚙️ Configurações</h1>

            <div class="card">
                <h3 class="mb-md">Perfil</h3>
                <div class="avatar-upload-row">
                    <div class="avatar-large clickable" onclick="openPhotoLightbox()" title="Clique para ampliar">
                        ${state.userFoto
                            ? `<img src="${state.userFoto}" alt="Foto de perfil" />`
                            : (state.userFullName ? state.userFullName.charAt(0).toUpperCase() : '👤')}
                    </div>
                    <div class="avatar-upload-info">
                        <div class="profile-name">${state.userFullName || ''}</div>
                        <div class="profile-username">Usuário: ${state.user || ''}</div>
                    </div>
                </div>
                <div class="avatar-upload-actions">
                    <label for="foto-input" class="btn-secondary"> Alterar Foto</label>
                    <input type="file" id="foto-input" accept="image/*" class="visually-hidden-input" />
                    ${state.userFoto ? `<button class="btn-secondary" onclick="removeProfilePhoto()">Remover Foto</button>` : ''}
                    <button class="btn-secondary" onclick="updateProfile()"> Editar Nome</button>
                    <button type="button" class="btn-secondary" onclick="abrirAlterarSenha()">Alterar Senha</button>
                </div>

                <div class="convite-amigos-box">
                    <div class="convite-amigos-titulo">🎉 Convide seus amigos</div>
                    <div class="convite-amigos-row">
                        <div class="convite-amigos-link" id="convite-link-texto">${INVITE_LINK}</div>
                        <button type="button" class="btn-secondary convite-amigos-copy" onclick="copiarLinkConvite()">📋 Copiar link</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 class="mb-md"> Tema</h3>
                <div class="row-wrap-sm">
                    <button class="btn-secondary" onclick="setTheme('light')">☀️ Claro</button>
                    <button class="btn-secondary" onclick="setTheme('dark')">🌙 Escuro</button>
                </div>
            </div>

            <div class="card" style="border-color:var(--color-danger);">
                <div class="acoes-conta-toggle" onclick="toggleAcoesConta()">
                    <h3 style="color:var(--color-danger);">⚠️ Ações de Conta</h3>
                    <span class="acoes-conta-chevron" id="acoes-conta-chevron">▼</span>
                </div>
                <div class="acoes-conta-body" id="acoes-conta-body">
                    <div class="row-wrap-sm">
                        <button class="btn-danger" onclick="resetAccount()"> Resetar Conta</button>
                        <button class="btn-danger" onclick="deleteAccount()">Excluir Conta</button>
                        <button class="btn-secondary" onclick="doLogout()"> Sair</button>
                    </div>
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
                registerForm.reset();
                document.querySelector('.login-tabs button[data-tab="login"]')?.click();
                // Garante que o usuário/senha não fiquem pré-preenchidos:
                // a pessoa precisa digitar suas credenciais para entrar.
                const loginUserField = document.getElementById('login-user');
                const loginPassField = document.getElementById('login-pass');
                if (loginUserField) loginUserField.value = '';
                if (loginPassField) loginPassField.value = '';
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
            const valorStr = document.getElementById('meta-valor').value;
            const anos = parseInt(document.getElementById('meta-anos').value, 10);
            const metaTotal = unmaskCurrency(valorStr);
            if (!titulo || !metaTotal || isNaN(anos) || anos < 1) {
                showToast('Preencha todos os campos corretamente', 'error');
                return;
            }
            try {
                await api.criarMeta(state.user, titulo, metaTotal, anos);
                showToast('Meta criada!', 'success');
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
}

// ========================================
// AÇÕES GLOBAIS
// ========================================
window.navigate = navigate;
window.doLogout = doLogout;

window.setTheme = (theme) => {
    const mudou = state.theme !== theme;
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
    localStorage.setItem('nexus_theme', theme);
    const icon = document.getElementById('theme-toggle');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';

    // A cor das categorias personalizadas depende do tema (branco no escuro,
    // preto no claro) — redesenha a view atual para os gráficos refletirem.
    if (mudou && state.user) {
        renderView(state.currentView);
    }
};

window.maskCurrency = maskCurrency;

// Abre um card/modal para a pessoa alterar a própria senha, consumindo
// diretamente a API de alteração de senha (/atualizar_senha).
window.abrirAlterarSenha = () => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2>🔒 Alterar Senha</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <form id="alterar-senha-form">
                <div class="form-group">
                    <label>Senha atual</label>
                    <input type="password" id="senha-atual-input" placeholder="Digite sua senha atual" required autofocus />
                </div>
                <div class="form-group">
                    <label>Nova senha</label>
                    <input type="password" id="senha-nova-input" placeholder="Digite a nova senha" required minlength="6" />
                </div>
                <div class="form-group">
                    <label>Confirmar nova senha</label>
                    <input type="password" id="senha-nova-confirm-input" placeholder="Confirme a nova senha" required minlength="6" />
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn-primary" id="alterar-senha-submit">Salvar</button>
                </div>
            </form>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    document.getElementById('alterar-senha-form').onsubmit = async (e) => {
        e.preventDefault();
        const senhaAtual = document.getElementById('senha-atual-input').value;
        const senhaNova = document.getElementById('senha-nova-input').value;
        const senhaNovaConfirm = document.getElementById('senha-nova-confirm-input').value;

        if (!senhaAtual || !senhaNova || !senhaNovaConfirm) {
            showToast('Preencha todos os campos', 'error');
            return;
        }
        if (senhaNova.length < 6) {
            showToast('A nova senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }
        if (senhaNova !== senhaNovaConfirm) {
            showToast('As senhas não coincidem', 'error');
            return;
        }

        const submitBtn = document.getElementById('alterar-senha-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';

        try {
            await api.atualizarSenha(state.user, senhaAtual, senhaNova);
            showToast('Senha atualizada com sucesso!', 'success');
            modal.remove();
        } catch (err) {
            showToast('Erro: ' + (err.message || 'Não foi possível alterar a senha'), 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar';
        }
    };
};

// Abre a foto de perfil ampliada em um lightbox. Só abre se houver foto.
window.openPhotoLightbox = () => {
    if (!state.userFoto) return;
    const overlay = document.createElement('div');
    overlay.className = 'photo-lightbox-overlay';
    overlay.innerHTML = `
        <button class="photo-lightbox-close" aria-label="Fechar">✕</button>
        <img src="${state.userFoto}" alt="Foto de perfil ampliada" />
    `;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('photo-lightbox-close')) {
            overlay.remove();
        }
    });
    document.body.appendChild(overlay);
};

// Copia o link de convite para a área de transferência.
window.copiarLinkConvite = async () => {
    try {
        await navigator.clipboard.writeText(INVITE_LINK);
        showToast('Link copiado!', 'success');
    } catch (err) {
        // Fallback para navegadores sem suporte à Clipboard API
        const temp = document.createElement('textarea');
        temp.value = INVITE_LINK;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        try {
            document.execCommand('copy');
            showToast('Link copiado!', 'success');
        } catch (e2) {
            showToast('Não foi possível copiar o link', 'error');
        }
        temp.remove();
    }
};

// Expande/recolhe o card de "Ações de Conta".
window.toggleAcoesConta = () => {
    const body = document.getElementById('acoes-conta-body');
    const chevron = document.getElementById('acoes-conta-chevron');
    if (!body) return;
    const abrindo = !body.classList.contains('open');
    body.classList.toggle('open', abrindo);
    if (chevron) chevron.classList.toggle('open', abrindo);
};

window.toggleCofrinho = async (el) => {
    // Marca ou desmarca a parcela — os quadradinhos podem ser alternados
    // livremente a qualquer momento.
    if (el.classList.contains('loading')) return;

    const indice = parseInt(el.dataset.index, 10);
    const titulo = el.dataset.titulo;
    const textoOriginal = el.textContent;

    el.classList.add('loading');
    el.textContent = '...';

    try {
        const resp = await api.marcarParcelaMeta(state.user, titulo, indice);

        // Atualiza o estado local com o que o servidor confirmou salvo,
        // para refletir exatamente o que está persistido no banco.
        const meta = (state.metas || []).find(m => m.titulo === titulo);
        if (meta) meta.parcelas = resp.parcelas || meta.parcelas;

        el.classList.remove('loading');
        el.classList.toggle('completed', !!resp.marcada);
        el.textContent = textoOriginal;
        el.title = resp.marcada ? 'Guardado — clique para desmarcar' : `Marcar como guardado`;

        // Atualiza o "Valor Atual" no resumo sem precisar recarregar a página.
        renderView(state.currentView);
        showToast(resp.marcada ? 'Parcela guardada com sucesso!' : 'Parcela desmarcada.', 'success');
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

window.editMeta = (titulo) => {
    const meta = (state.metas || []).find(m => m.titulo === titulo);
    if (!meta) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:420px;">
            <div class="modal-header">
                <h2>✏️ Editar Meta</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <form id="edit-meta-form">
                <div class="form-group">
                    <label>Título</label>
                    <input type="text" id="edit-meta-titulo" value="${meta.titulo}" required />
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Valor da Meta</label>
                        <input type="text" id="edit-meta-valor" value="R$ ${meta.meta_total.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}" oninput="maskCurrency(this)" required />
                    </div>
                    <div class="form-group">
                        <label>Em quantos anos?</label>
                        <input type="number" id="edit-meta-anos" value="${meta.anos}" min="1" max="40" required />
                    </div>
                </div>
                <p style="color:var(--color-warning, #f5b86e);font-size:0.85rem;margin-bottom:12px;">
                    ⚠️ Editar essa meta vai zerar todas as parcelas já guardadas, já que o valor de cada parcela muda junto.
                </p>
                <button type="submit" class="btn-primary" style="width:100%;">Salvar Alterações</button>
            </form>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    document.getElementById('edit-meta-form').onsubmit = async (e) => {
        e.preventDefault();
        const novoTitulo = document.getElementById('edit-meta-titulo').value.trim();
        const novoValor = unmaskCurrency(document.getElementById('edit-meta-valor').value);
        const novosAnos = parseInt(document.getElementById('edit-meta-anos').value, 10);
        if (!novoTitulo || !novoValor || isNaN(novosAnos) || novosAnos < 1) {
            showToast('Preencha todos os campos corretamente', 'error');
            return;
        }

        // Editar sempre zera as parcelas guardadas — pede confirmação antes.
        const temParcelas = meta.parcelas && meta.parcelas.length > 0;
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal" style="max-width:400px;">
                <div class="modal-header">
                    <h2>⚠️ Confirmar edição</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <p style="color:var(--text-secondary);margin-bottom:20px;">
                    ${temParcelas
                        ? 'Salvar essa edição vai <strong>zerar todas as parcelas</strong> que você já marcou como guardadas nessa meta. Tem certeza que deseja continuar?'
                        : 'Salvar essa edição vai reiniciar o progresso da meta (as parcelas guardadas futuras partirão do zero). Tem certeza que deseja continuar?'}
                </p>
                <div style="display:flex;gap:12px;justify-content:flex-end;">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button class="btn-danger" id="confirm-meta-edit">Sim, salvar e zerar</button>
                </div>
            </div>
        `;
        confirmModal.addEventListener('click', (e2) => { if (e2.target === confirmModal) confirmModal.remove(); });
        document.body.appendChild(confirmModal);

        document.getElementById('confirm-meta-edit').addEventListener('click', async () => {
            confirmModal.remove();
            try {
                await api.atualizarMeta(state.user, meta.titulo, novoTitulo, novoValor, novosAnos);
                showToast('Meta atualizada! As parcelas foram zeradas.', 'success');
                modal.remove();
                await loadDashboardData();
            } catch (err) {
                showToast('Erro: ' + (err.message || ''), 'error');
            }
        });
    };
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

window.updateProfile = () => {
    const nomeAtual = state.userFullName?.split(' ')[0] || '';
    const sobrenomeAtual = state.userFullName?.split(' ').slice(1).join(' ') || '';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2> Editar Nome</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p class="sub" style="text-align:left;margin-bottom:20px;">Qual é o seu nome?</p>
            <form id="edit-nome-form">
                <div class="form-group">
                    <label>Nome</label>
                    <input type="text" id="edit-nome-input" placeholder="João" value="${nomeAtual}" required autofocus />
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn-primary">Continuar</button>
                </div>
            </form>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    document.getElementById('edit-nome-form').onsubmit = (e) => {
        e.preventDefault();
        const nome = document.getElementById('edit-nome-input').value.trim();
        if (!nome) { showToast('Digite um nome válido', 'error'); return; }
        modal.remove();
        showEditSobrenomeModal(nome, sobrenomeAtual);
    };
};

function showEditSobrenomeModal(nome, sobrenomeAtual) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div class="modal-header">
                <h2> Editar Sobrenome</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <p class="sub" style="text-align:left;margin-bottom:20px;">E o seu sobrenome, <strong>${formatName(nome)}</strong>?</p>
            <form id="edit-sobrenome-form">
                <div class="form-group">
                    <label>Sobrenome</label>
                    <input type="text" id="edit-sobrenome-input" placeholder="Silva" value="${sobrenomeAtual}" required autofocus />
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;">
                    <button type="button" class="btn-secondary" id="edit-sobrenome-voltar">← Voltar</button>
                    <button type="submit" class="btn-primary">Salvar</button>
                </div>
            </form>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    document.getElementById('edit-sobrenome-voltar').onclick = () => {
        modal.remove();
        window.updateProfile();
    };

    document.getElementById('edit-sobrenome-form').onsubmit = async (e) => {
        e.preventDefault();
        const sobrenome = document.getElementById('edit-sobrenome-input').value.trim();
        if (!sobrenome) { showToast('Digite um sobrenome válido', 'error'); return; }
        try {
            await api.atualizarNomeSobrenome(state.user, nome, sobrenome);
            const nomeCompleto = `${nome} ${sobrenome}`.trim();
            const nomeFormatado = formatName(nomeCompleto);

            state.userFullName = nomeFormatado;
            state.userName = nomeFormatado.split(' ')[0];

            localStorage.setItem(USER_NAME_KEY, state.userName);
            localStorage.setItem(USER_FULL_KEY, state.userFullName);

            modal.remove();
            showToast('Perfil atualizado!', 'success');
            renderView('configuracoes');
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    };
}

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
            showToast('Conta resetada! Seus dados foram apagados.', 'success');
            // Não desloga a pessoa — apenas limpa os dados e recarrega tudo
            // do zero, mantendo a sessão ativa.
            await loadDashboardData();
            navigate('dashboard');
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
    const opcoesExistentes = lista.length === 0
        ? `<option value="">Nenhuma categoria disponível</option>`
        : lista.map(cat => `<option value="${cat}" ${cat === selecionada ? 'selected' : ''}>${cat}</option>`).join('');

    return `${opcoesExistentes}<option value="${NOVA_CATEGORIA_VALUE}">Adicionar categoria...</option>`;
}

// Modal bonitinho pra pessoa digitar o nome de uma categoria nova, no
// lugar do prompt() feio do navegador. Resolve com o nome digitado ou
// null se a pessoa cancelar.
function abrirModalNovaCategoria(tipo) {
    return new Promise((resolve) => {
        const rotuloTipo = tipo === 'receita' ? 'receita' : 'despesa';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:380px;">
                <div class="modal-header">
                    <h2>Nova categoria</h2>
                    <button type="button" class="modal-close" id="nova-categoria-fechar">✕</button>
                </div>
                <p class="sub" style="text-align:left;margin-bottom:16px;">Digite o nome da nova categoria de ${rotuloTipo}:</p>
                <form id="nova-categoria-form">
                    <div class="form-group">
                        <label>Nome da categoria</label>
                        <input type="text" id="nova-categoria-nome" placeholder="Ex: Pet, Cursos, Assinaturas..." maxlength="40" autocomplete="off" required />
                    </div>
                    <div style="display:flex;gap:12px;justify-content:flex-end;">
                        <button type="button" class="btn-secondary" id="nova-categoria-cancelar">Cancelar</button>
                        <button type="submit" class="btn-primary">Adicionar</button>
                    </div>
                </form>
            </div>
        `;

        const fechar = (valor) => {
            modal.removeEventListener('click', onOverlayClick);
            modal.remove();
            resolve(valor);
        };
        const onOverlayClick = (e) => { if (e.target === modal) fechar(null); };

        modal.addEventListener('click', onOverlayClick);
        document.body.appendChild(modal);

        modal.querySelector('#nova-categoria-fechar').onclick = () => fechar(null);
        modal.querySelector('#nova-categoria-cancelar').onclick = () => fechar(null);
        modal.querySelector('#nova-categoria-form').onsubmit = (e) => {
            e.preventDefault();
            const nome = document.getElementById('nova-categoria-nome').value.trim();
            fechar(nome || null);
        };

        setTimeout(() => document.getElementById('nova-categoria-nome')?.focus(), 60);
    });
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
                <h2>${isEdicao ? ' Editar Transação' : '➕ Nova Transação'}</h2>
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
            categoriaSelect.innerHTML = categoriaOptionsHTML(this.value, null);
        });
    }

    categoriaSelect.addEventListener('change', async function() {
        if (this.value !== NOVA_CATEGORIA_VALUE) return;

        const tipoAtual = tipoSelect.value;
        const nomeAnterior = tx ? tx.categoria : null;

        const nomeNovo = await abrirModalNovaCategoria(tipoAtual);

        if (!nomeNovo) {
            // Cancelou: volta pra categoria anterior (ou primeira disponível)
            this.innerHTML = categoriaOptionsHTML(tipoAtual, nomeAnterior);
            return;
        }

        try {
            const resp = await api.criarCategoria(state.user, tipoAtual, nomeNovo.trim());
            const catResp = await api.listarCategorias(state.user);
            state.categories = catResp;
            buildCategoryColorMap();
            this.innerHTML = categoriaOptionsHTML(tipoAtual, resp.nome);
            showToast('✅ Categoria criada!', 'success');
        } catch (err) {
            showToast('Erro: ' + (err.message || 'Não foi possível criar a categoria'), 'error');
            this.innerHTML = categoriaOptionsHTML(tipoAtual, nomeAnterior);
        }
    });

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
        const href = el.getAttribute('href');
        // Ignora links externos (ex.: Nexus Calc) — devem abrir normalmente
        // em nova aba, sem passar pelo roteador interno do SPA.
        if (!href || !href.startsWith('#/')) return;
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const view = href.replace('#/', '');
            navigate(view);
        });
    });

    window.addEventListener('hashchange', handleHashChange);

    if (checkSession()) {
        loadDashboardData();
    } else {
        navigate('login');
    }

    // Verifica periodicamente se o mês virou (ex: app aberto passando da
    // meia-noite do último dia do mês) para recarregar tudo zerado no
    // mês novo, e também sempre que a aba voltar a ficar visível. Também
    // efetiva, sem esperar o dia virar, qualquer transação pendente cuja
    // data já chegou (cobre o caso do app já estar aberto no dia certo).
    setInterval(verificarMudancaDeMes, 60 * 1000);
    setInterval(verificarTransacoesVencidasEmSegundoPlano, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            verificarMudancaDeMes();
            verificarTransacoesVencidasEmSegundoPlano();
        }
    });
});
