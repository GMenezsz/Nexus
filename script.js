// script.js - Lógica Central da Aplicação SPA
(function() {
    'use strict';

    // ========================================
    // CONFIGURAÇÕES GLOBAIS
    // ========================================
    const API_BASE = 'https://nexus-api-mz3t.onrender.com';
    const STORAGE_KEY = 'nexus_user';
    const STORAGE_THEME = 'nexus_theme';
    const STORAGE_LANG = 'nexus_lang';

    // ========================================
    // ESTADO GLOBAL
    // ========================================
    const state = {
        user: null,
        userName: null,
        userFullName: null,
        userFoto: null,
        theme: localStorage.getItem(STORAGE_THEME) || 'light',
        lang: localStorage.getItem(STORAGE_LANG) || 'pt',
        currentView: 'dashboard',
        transactions: [],
        categories: { receita: [], despesa: [] },
        metas: [],
        resumo: null,
        isMobile: window.innerWidth <= 768,
        sidebarOpen: false,
        editingTransaction: null,
        editingMeta: null,
        currentPage: 1,
        pageSize: 10,
    };

    // ========================================
    // INTERNACIONALIZAÇÃO (i18n)
    // ========================================
    const i18n = {
        pt: {
            appName: 'Nexus',
            login: 'Entrar',
            register: 'Cadastrar',
            logout: 'Sair',
            dashboard: 'Dashboard',
            transacoes: 'Transações',
            planejamento: 'Planejamento',
            relatorios: 'Relatórios',
            configuracoes: 'Configurações',
            saldoAtual: 'Saldo Atual',
            receitas: 'Receitas',
            despesas: 'Despesas',
            balancoMensal: 'Balanço Mensal',
            planejamentoMensal: 'Planejamento Mensal',
            definirPlanejamento: 'Definir meu planejamento',
            semPlanejamento: 'Opa! Você ainda não possui um planejamento definido para este mês.',
            criarTransacao: 'Criar Transação',
            editarTransacao: 'Editar Transação',
            tipo: 'Tipo',
            categoria: 'Categoria',
            valor: 'Valor',
            data: 'Data',
            status: 'Situação',
            acoes: 'Ações',
            pago: 'Pago',
            pendente: 'Pendente',
            deletar: 'Deletar',
            editar: 'Editar',
            salvar: 'Salvar',
            cancelar: 'Cancelar',
            confirmar: 'Confirmar',
            sim: 'Sim',
            nao: 'Não',
            temaClaro: 'Claro',
            temaEscuro: 'Escuro',
            tema: 'Tema',
            idioma: 'Idioma',
            perfil: 'Perfil',
            senha: 'Senha',
            alterarSenha: 'Alterar Senha',
            resetarConta: 'Resetar Conta',
            excluirConta: 'Excluir Conta',
            bemVindo: 'Olá',
            metaTotal: 'Meta Total',
            totalGuardado: 'Total Guardado',
            progresso: 'Progresso',
            titulo: 'Título',
            salarioLiquido: 'Salário Líquido',
            porcentagemMeta: 'Porcentagem da Meta',
            criarMeta: 'Criar Meta',
            editarMeta: 'Editar Meta',
            criar: 'Criar',
            semTransacoes: 'Nenhuma transação encontrada.',
            carregando: 'Carregando...',
            erroCarregamento: 'Erro ao carregar dados.',
            senhaAntiga: 'Senha Antiga',
            novaSenha: 'Nova Senha',
            confirmarSenha: 'Confirmar Senha',
            usuario: 'Usuário',
            nome: 'Nome',
            sobrenome: 'Sobrenome',
            foto: 'Foto',
            alterarFoto: 'Alterar Foto',
            enviar: 'Enviar',
        },
        en: {
            appName: 'Nexus',
            login: 'Login',
            register: 'Sign Up',
            logout: 'Logout',
            dashboard: 'Dashboard',
            transacoes: 'Transactions',
            planejamento: 'Planning',
            relatorios: 'Reports',
            configuracoes: 'Settings',
            saldoAtual: 'Current Balance',
            receitas: 'Income',
            despesas: 'Expenses',
            balancoMensal: 'Monthly Balance',
            planejamentoMensal: 'Monthly Planning',
            definirPlanejamento: 'Set my planning',
            semPlanejamento: 'Oops! You don\'t have a planning set for this month yet.',
            criarTransacao: 'Create Transaction',
            editarTransacao: 'Edit Transaction',
            tipo: 'Type',
            categoria: 'Category',
            valor: 'Amount',
            data: 'Date',
            status: 'Status',
            acoes: 'Actions',
            pago: 'Paid',
            pendente: 'Pending',
            deletar: 'Delete',
            editar: 'Edit',
            salvar: 'Save',
            cancelar: 'Cancel',
            confirmar: 'Confirm',
            sim: 'Yes',
            nao: 'No',
            temaClaro: 'Light',
            temaEscuro: 'Dark',
            tema: 'Theme',
            idioma: 'Language',
            perfil: 'Profile',
            senha: 'Password',
            alterarSenha: 'Change Password',
            resetarConta: 'Reset Account',
            excluirConta: 'Delete Account',
            bemVindo: 'Hello',
            metaTotal: 'Total Goal',
            totalGuardado: 'Total Saved',
            progresso: 'Progress',
            titulo: 'Title',
            salarioLiquido: 'Net Salary',
            porcentagemMeta: 'Goal Percentage',
            criarMeta: 'Create Goal',
            editarMeta: 'Edit Goal',
            criar: 'Create',
            semTransacoes: 'No transactions found.',
            carregando: 'Loading...',
            erroCarregamento: 'Error loading data.',
            senhaAntiga: 'Old Password',
            novaSenha: 'New Password',
            confirmarSenha: 'Confirm Password',
            usuario: 'Username',
            nome: 'First Name',
            sobrenome: 'Last Name',
            foto: 'Photo',
            alterarFoto: 'Change Photo',
            enviar: 'Submit',
        }
    };

    function t(key) {
        return i18n[state.lang]?.[key] || key;
    }

    // ========================================
    // HELPERS / UTILITÁRIOS
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
        return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }

    function todayStr() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    function parseDateBR(dateBR) {
        const parts = dateBR.split('/');
        if (parts.length !== 3) return null;
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    }

    function isDatePastOrToday(dateBR) {
        const d = parseDateBR(dateBR);
        if (!d) return true;
        const today = new Date();
        today.setHours(0,0,0,0);
        return d <= today;
    }

    function getFirstWord(name) {
        return name ? name.split(' ')[0] : '';
    }

    function debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
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
            container.style.cssText = `
                position: fixed; bottom: 24px; right: 24px; z-index: 9999;
                display: flex; flex-direction: column; gap: 8px; max-width: 360px;
            `;
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.style.cssText = `
            padding: 14px 20px; border-radius: var(--radius-md); 
            background: var(--bg-card); color: var(--text-primary);
            box-shadow: var(--shadow-lg); border-left: 4px solid ${type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-danger)' : 'var(--color-info)'};
            animation: slideIn 0.3s ease; font-weight: 500;
            border: 1px solid var(--border-color);
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
    // API CLIENT
    // ========================================
    const api = {
        async fetchJSON(endpoint, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
            const response = await fetch(url, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            });
            if (!response.ok) {
                const err = await response.text().catch(() => '');
                throw new Error(err || `HTTP ${response.status}`);
            }
            return response.json();
        },

        async login(usuario, senha) {
            return this.fetchJSON('/login', {
                method: 'POST',
                body: JSON.stringify({ usuario, senha }),
            });
        },

        async criarConta(nome, sobrenome, usuario, senha) {
            return this.fetchJSON('/criar_conta', {
                method: 'POST',
                body: JSON.stringify({ nome, sobrenome, usuario, senha }),
            });
        },

        async atualizarNomeSobrenome(usuario, nome, sobrenome) {
            return this.fetchJSON('/atualizar_nome_sobrenome', {
                method: 'PUT',
                body: JSON.stringify({ usuario, nome, sobrenome }),
            });
        },

        async atualizarSenha(usuario, senha_antiga, nova_senha) {
            return this.fetchJSON('/atualizar_senha', {
                method: 'PUT',
                body: JSON.stringify({ usuario, senha_antiga, nova_senha }),
            });
        },

        async recuperarSenha(usuario, nova_senha) {
            return this.fetchJSON('/recuperar_senha', {
                method: 'PUT',
                body: JSON.stringify({ usuario, nova_senha }),
            });
        },

        async deletarUsuario(usuario) {
            return this.fetchJSON(`/deletar_usuario?usuario=${encodeURIComponent(usuario)}`, {
                method: 'DELETE',
            });
        },

        async reiniciarConta(usuario) {
            return this.fetchJSON(`/reiniciar_conta?usuario=${encodeURIComponent(usuario)}`, {
                method: 'DELETE',
            });
        },

        async listarMetas(usuario) {
            // A API responde { "metas": [...] }, não um array direto
            const data = await this.fetchJSON(`/metas/listar?usuario=${encodeURIComponent(usuario)}`);
            return data.metas || [];
        },

        async criarMeta(usuario, titulo, salario_liquido, porcentagem_meta) {
            return this.fetchJSON('/metas/criar', {
                method: 'POST',
                body: JSON.stringify({ usuario, titulo, salario_liquido, porcentagem_meta }),
            });
        },

        async atualizarMeta(usuario, titulo_antigo, titulo_novo, salario_liquido, porcentagem_meta) {
            return this.fetchJSON('/metas/atualizar', {
                method: 'PUT',
                body: JSON.stringify({ usuario, titulo_antigo, titulo_novo, salario_liquido, porcentagem_meta }),
            });
        },

        async deletarMeta(usuario, titulo) {
            return this.fetchJSON(`/metas/deletar?usuario=${encodeURIComponent(usuario)}&titulo=${encodeURIComponent(titulo)}`, {
                method: 'DELETE',
            });
        },

        async listarCategorias() {
            return this.fetchJSON('/categorias');
        },

        async criarTransacao(usuario, tipo, categoria, valor, data, status) {
            return this.fetchJSON('/transacoes/criar', {
                method: 'POST',
                body: JSON.stringify({ usuario, tipo, categoria, valor, data, status }),
            });
        },

        async listarTransacoes(usuario) {
            // A API responde { "transacoes": [...] }, não um array direto
            const data = await this.fetchJSON(`/transacoes/listar?usuario=${encodeURIComponent(usuario)}`);
            return data.transacoes || [];
        },

        async getResumo(usuario) {
            return this.fetchJSON(`/transacoes/resumo?usuario=${encodeURIComponent(usuario)}`);
        },

        async atualizarTransacao(usuario, transacao_id, tipo, categoria, valor, data, status) {
            return this.fetchJSON('/transacoes/atualizar', {
                method: 'PUT',
                body: JSON.stringify({ usuario, transacao_id, tipo, categoria, valor, data, status }),
            });
        },

        async deletarTransacao(usuario, transacao_id) {
            return this.fetchJSON('/transacoes/deletar', {
                method: 'DELETE',
                body: JSON.stringify({ usuario, transacao_id: Number(transacao_id) }),
            });
        },

        async atualizarFoto(usuario, foto) {
            return this.fetchJSON('/atualizar_foto', {
                method: 'PUT',
                body: JSON.stringify({ usuario, foto }),
            });
        },
    };

    // ========================================
    // ROTEAMENTO SPA
    // ========================================
    function navigate(view, params = {}) {
        state.currentView = view;
        window.location.hash = `#/${view}`;
        renderView(view, params);
        updateSidebarActive(view);
        if (state.isMobile) closeSidebar();
    }

    function handleHashChange() {
        const hash = window.location.hash.slice(2) || 'dashboard';
        const view = hash.split('?')[0];
        if (state.user) {
            renderView(view);
            updateSidebarActive(view);
        } else if (view !== 'login' && view !== 'register') {
            renderView('login');
        } else {
            renderView(view);
        }
    }

    // ========================================
    // SIDEBAR
    // ========================================
    function toggleSidebar() {
        if (state.isMobile) {
            state.sidebarOpen = !state.sidebarOpen;
            document.getElementById('sidebar').classList.toggle('open', state.sidebarOpen);
        } else {
            document.getElementById('sidebar').classList.toggle('expanded');
        }
    }

    function closeSidebar() {
        if (state.isMobile) {
            state.sidebarOpen = false;
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    function updateSidebarActive(view) {
        document.querySelectorAll('#sidebar .nav-item').forEach(el => {
            el.classList.toggle('active', el.getAttribute('href') === `#/${view}`);
        });
    }

    // ========================================
    // TEMA
    // ========================================
    function applyTheme(theme) {
        state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
        localStorage.setItem(STORAGE_THEME, theme);
        const icon = document.getElementById('theme-icon');
        if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    function toggleTheme() {
        applyTheme(state.theme === 'light' ? 'dark' : 'light');
    }

    // ========================================
    // HEADER (auth state)
    // ========================================
    function updateHeaderAuthUI() {
        const link = document.getElementById('header-login-link');
        const userEl = document.getElementById('header-user');
        if (state.user) {
            if (link) link.style.display = 'none';
            if (userEl) {
                userEl.style.display = 'inline-flex';
                userEl.textContent = state.userFullName || state.userName || state.user;
                userEl.style.cursor = 'pointer';
                userEl.onclick = () => window.navigate('configuracoes');
            }
        } else {
            if (link) {
                link.style.display = '';
                link.textContent = t('login');
                link.href = '#/login';
                link.onclick = null;
            }
            if (userEl) {
                userEl.style.display = 'none';
                userEl.onclick = null;
            }
        }
    }

    // ========================================
    // PWA INSTALL
    // ========================================
    let deferredPrompt = null;
    function setupPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const btn = document.getElementById('pwa-install-btn');
            if (btn) btn.style.display = 'inline-flex';
        });
        document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const result = await deferredPrompt.userChoice;
                if (result.outcome === 'accepted') {
                    showToast('App instalado com sucesso! 🎉', 'success');
                }
                deferredPrompt = null;
                document.getElementById('pwa-install-btn').style.display = 'none';
            }
        });
        window.addEventListener('appinstalled', () => {
            showToast('App instalado!', 'success');
        });
    }

    // ========================================
    // SESSÃO PERMANENTE
    // ========================================
    async function checkSession() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        let saved;
        try {
            saved = JSON.parse(raw);
        } catch (e) {
            // Compatibilidade com versão antiga que salvava só a string do usuário
            saved = { usuario: raw, nome: '' };
        }

        state.user = saved.usuario;
        state.userFullName = saved.nome || '';
        state.userName = getFirstWord(saved.nome || '');
        state.userFoto = saved.foto || null;

        try {
            const resumo = await api.getResumo(state.user);
            state.resumo = resumo;
            return true;
        } catch (err) {
            localStorage.removeItem(STORAGE_KEY);
            state.user = null;
            state.userName = null;
            state.userFullName = null;
            state.userFoto = null;
            return false;
        }
    }

    async function initSession() {
        const hasSession = await checkSession();
        if (hasSession) {
            navigate('dashboard');
            loadDashboardData();
        } else {
            navigate('login');
        }
        updateHeaderAuthUI();
    }

    function doLogin(user, nomeCompleto, foto) {
        state.user = user;
        state.userFullName = nomeCompleto;
        state.userName = getFirstWord(nomeCompleto);
        state.userFoto = foto || null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ usuario: user, nome: nomeCompleto, foto: foto || '' }));
        navigate('dashboard');
        loadDashboardData();
        updateHeaderAuthUI();
    }

    function doLogout() {
        localStorage.removeItem(STORAGE_KEY);
        state.user = null;
        state.userName = null;
        state.userFullName = null;
        state.userFoto = null;
        state.resumo = null;
        state.transactions = [];
        state.metas = [];
        navigate('login');
        updateHeaderAuthUI();
    }

    // ========================================
    // RENDER VIEWS (SPA)
    // ========================================
    function renderView(view, params = {}) {
        const container = document.getElementById('view-container');
        if (!container) return;

        switch (view) {
            case 'login': container.innerHTML = renderLogin(); break;
            case 'dashboard': container.innerHTML = renderDashboard(); break;
            case 'transacoes': container.innerHTML = renderTransacoes(); break;
            case 'planejamento': container.innerHTML = renderPlanejamento(); break;
            case 'relatorios': container.innerHTML = renderRelatorios(); break;
            case 'configuracoes': container.innerHTML = renderConfiguracoes(); break;
            default: container.innerHTML = '<div class="view"><h2>Página não encontrada</h2></div>';
        }
        // Re-aplicar event listeners após renderização
        bindEvents(view);
    }

    // ========================================
    // RENDER: LOGIN
    // ========================================
    function renderLogin() {
        return `
            <div class="view login-container">
                <h1>${t('appName')}</h1>
                <p class="sub">${t('login')} ou ${t('register')}</p>
                <div class="login-tabs">
                    <button class="active" data-tab="login">${t('login')}</button>
                    <button data-tab="register">${t('register')}</button>
                </div>
                <div id="login-form-container">
                    <!-- Login form -->
                    <form id="login-form">
                        <div class="form-group">
                            <label>${t('usuario')}</label>
                            <input type="text" id="login-user" placeholder="seu_usuario" required />
                        </div>
                        <div class="form-group">
                            <label>${t('senha')}</label>
                            <input type="password" id="login-pass" placeholder="••••••••" required />
                        </div>
                        <button type="submit" class="btn-primary">${t('login')}</button>
                    </form>
                </div>
                <div id="register-form-container" style="display:none;">
                    <form id="register-form">
                        <div class="form-group">
                            <label>${t('nome')}</label>
                            <input type="text" id="reg-nome" placeholder="João" required />
                        </div>
                        <div class="form-group">
                            <label>${t('sobrenome')}</label>
                            <input type="text" id="reg-sobrenome" placeholder="Silva" required />
                        </div>
                        <div class="form-group">
                            <label>${t('usuario')}</label>
                            <input type="text" id="reg-user" placeholder="seu_usuario" required />
                        </div>
                        <div class="form-group">
                            <label>${t('senha')}</label>
                            <input type="password" id="reg-pass" placeholder="••••••••" required />
                        </div>
                        <button type="submit" class="btn-primary">${t('register')}</button>
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
        const nome = state.userName || t('usuario');
        const fullName = state.userFullName || '';

        return `
            <div class="view">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
                    <h1 style="font-weight:600;font-size:1.5rem;">${t('bemVindo')}, ${nome} 👋</h1>
                    <div style="display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="window.navigate('configuracoes')">
                        <div style="width:40px;height:40px;border-radius:50%;background:${state.userFoto ? `url('${state.userFoto}') center/cover` : 'var(--color-purple-bg)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--color-purple);font-weight:600;border:2px solid var(--color-purple);">
                            ${state.userFoto ? '' : (fullName ? fullName.charAt(0).toUpperCase() : '👤')}
                        </div>
                        <span style="font-weight:500;">${fullName || t('perfil')}</span>
                    </div>
                </div>

                <div class="card-grid">
                    <div class="card stat-info">
                        <div class="card-title">${t('saldoAtual')}</div>
                        <div class="card-value">${formatCurrency(saldo)}</div>
                    </div>
                    <div class="card stat-success">
                        <div class="card-title">${t('receitas')}</div>
                        <div class="card-value">${formatCurrency(receitas)}</div>
                    </div>
                    <div class="card stat-danger">
                        <div class="card-title">${t('despesas')}</div>
                        <div class="card-value">${formatCurrency(despesas)}</div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
                    <div class="card">
                        <h3 style="font-size:1rem;margin-bottom:12px;">📊 ${t('receitas')} por Categoria</h3>
                        <div id="chart-income" style="height:180px;display:flex;align-items:center;justify-content:center;background:var(--bg-input);border-radius:var(--radius-sm);">
                            <span style="color:var(--text-muted);">${t('carregando')}...</span>
                        </div>
                        <button class="btn-secondary" style="margin-top:12px;width:100%;" onclick="window.navigate('relatorios')">Ver mais →</button>
                    </div>
                    <div class="card">
                        <h3 style="font-size:1rem;margin-bottom:12px;">📊 ${t('despesas')} por Categoria</h3>
                        <div id="chart-expense" style="height:180px;display:flex;align-items:center;justify-content:center;background:var(--bg-input);border-radius:var(--radius-sm);">
                            <span style="color:var(--text-muted);">${t('carregando')}...</span>
                        </div>
                        <button class="btn-secondary" style="margin-top:12px;width:100%;" onclick="window.navigate('relatorios')">Ver mais →</button>
                    </div>
                </div>

                <div class="card" style="margin-bottom:20px;">
                    <h3 style="font-size:1rem;margin-bottom:12px;">📈 ${t('balancoMensal')}</h3>
                    <div id="chart-monthly" style="height:150px;display:flex;align-items:center;justify-content:center;background:var(--bg-input);border-radius:var(--radius-sm);">
                        <span style="color:var(--text-muted);">${t('carregando')}...</span>
                    </div>
                </div>

                <div class="card">
                    <h3 style="font-size:1rem;margin-bottom:12px;">🎯 ${t('planejamentoMensal')}</h3>
                    <div id="planning-preview">
                        ${renderPlanningPreview()}
                    </div>
                </div>
            </div>
        `;
    }

    function renderPlanningPreview() {
        if (!state.metas || state.metas.length === 0) {
            return `<p style="color:var(--text-muted);">${t('semPlanejamento')}</p>
                    <button class="btn-primary" onclick="window.navigate('planejamento')">${t('definirPlanejamento')}</button>`;
        }
        const meta = state.metas[0];
        // A API não devolve a porcentagem cadastrada, só o valor-alvo já calculado (meta.meta)
        const percentual = meta.salario_liquido > 0 ? Math.round((meta.meta / meta.salario_liquido) * 100) : 0;
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div><strong>${meta.titulo}</strong></div>
                <div>💰 ${formatCurrency(meta.salario_liquido)}</div>
                <div>🎯 ${percentual}% (${formatCurrency(meta.meta)})</div>
                <button class="btn-secondary" onclick="window.navigate('planejamento')">Ver detalhes →</button>
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
        const totalPages = Math.ceil(transacoes.length / state.pageSize) || 1;
        const start = (state.currentPage - 1) * state.pageSize;
        const pageItems = transacoes.slice(start, start + state.pageSize);

        return `
            <div class="view">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
                    <h1 style="font-weight:600;font-size:1.5rem;">💳 ${t('transacoes')}</h1>
                    <button class="btn-primary" onclick="window.openTransactionModal()">+ ${t('criarTransacao')}</button>
                </div>

                <div class="card-grid">
                    <div class="card stat-info"><div class="card-title">${t('saldoAtual')}</div><div class="card-value">${formatCurrency(saldo)}</div></div>
                    <div class="card stat-success"><div class="card-title">${t('receitas')}</div><div class="card-value">${formatCurrency(receitas)}</div></div>
                    <div class="card stat-danger"><div class="card-title">${t('despesas')}</div><div class="card-value">${formatCurrency(despesas)}</div></div>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:30px;"><input type="checkbox" id="select-all" /></th>
                                <th>${t('categoria')}</th>
                                <th>${t('valor')}</th>
                                <th>${t('data')}</th>
                                <th>${t('status')}</th>
                                <th>${t('acoes')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageItems.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">${t('semTransacoes')}</td></tr>` : ''}
                            ${pageItems.map(tx => {
                                // A API usa "pago"/"pendente" como valores de status (default "pago")
                                const isPago = tx.status ? tx.status === 'pago' : isDatePastOrToday(tx.data);
                                const statusText = isPago ? t('pago') : t('pendente');
                                const statusBadge = isPago ? 'badge-success' : 'badge-warning';
                                return `
                                    <tr>
                                        <td><input type="checkbox" class="row-select" data-id="${tx.id}" /></td>
                                        <td>${tx.categoria}</td>
                                        <td style="color:${tx.tipo === 'receita' ? 'var(--color-success)' : 'var(--color-danger)'};">${formatCurrency(tx.valor)}</td>
                                        <td>${formatDateBR(tx.data)}</td>
                                        <td><span class="badge ${statusBadge}">${statusText}</span></td>
                                        <td>
                                            <button class="icon-btn" onclick="window.openTransactionModal('${tx.id}')">✏️</button>
                                            <button class="icon-btn" onclick="window.deleteTransaction('${tx.id}')">🗑️</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="pagination">
                    ${Array.from({length: totalPages}, (_, i) => i + 1).map(p =>
                        `<button class="${p === state.currentPage ? 'active' : ''}" onclick="window.goToPage(${p})">${p}</button>`
                    ).join('')}
                </div>

                <div style="display:flex;gap:8px;margin-top:8px;">
                    <button class="btn-danger btn-sm" onclick="window.bulkDelete()">🗑️ ${t('deletar')} selecionados</button>
                </div>
            </div>
        `;
    }

    // ========================================
    // RENDER: PLANEJAMENTO
    // ========================================
    function renderPlanejamento() {
        const meta = state.metas && state.metas.length > 0 ? state.metas[0] : null;
        const totalGuardado = 0; // Placeholder - será calculado com base nos cofrinhos
        // A API já devolve o valor-alvo pronto no campo "meta" (não devolve a porcentagem cadastrada)
        const metaTotal = meta ? meta.meta : 0;
        const percentualAtual = meta && meta.salario_liquido > 0 ? Math.round((meta.meta / meta.salario_liquido) * 100) : '';
        const cells = meta ? Math.ceil(metaTotal / 50) : 12; // Divide em 12 porções padrão

        return `
            <div class="view">
                <h1 style="font-weight:600;font-size:1.5rem;margin-bottom:20px;">🎯 ${t('planejamento')}</h1>

                <div class="card" style="margin-bottom:20px;">
                    <h3 style="font-size:1rem;margin-bottom:12px;">${meta ? t('editarMeta') : t('criarMeta')}</h3>
                    <form id="meta-form">
                        <div class="form-group">
                            <label>${t('titulo')}</label>
                            <input type="text" id="meta-titulo" value="${meta ? meta.titulo : ''}" placeholder="Ex: Viagem" required />
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>${t('salarioLiquido')}</label>
                                <input type="text" id="meta-salario" value="${meta ? formatCurrency(meta.salario_liquido) : ''}" placeholder="R$ 0,00" oninput="window.maskCurrency(this)" />
                            </div>
                            <div class="form-group">
                                <label>${t('porcentagemMeta')}</label>
                                <input type="number" id="meta-porcentagem" value="${percentualAtual}" placeholder="10" min="0" max="100" required />
                                ${meta ? `<small style="color:var(--text-muted);">Valor aproximado (a API não retorna a porcentagem original salva).</small>` : ''}
                            </div>
                        </div>
                        <button type="submit" class="btn-primary">${meta ? t('editar') : t('criar')}</button>
                        ${meta ? `<button type="button" class="btn-danger" style="margin-left:8px;" onclick="window.deleteMeta('${meta.titulo}')">🗑️ ${t('deletar')}</button>` : ''}
                    </form>
                </div>

                ${meta ? `
                    <div class="card" style="margin-bottom:20px;">
                        <h3 style="font-size:1rem;margin-bottom:8px;">Desafio do Cofrinho: ${meta.titulo}</h3>
                        <div class="cofrinho-summary" style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px;">
                            <div><strong>${t('metaTotal')}:</strong> ${formatCurrency(metaTotal)}</div>
                            <div><strong>${t('totalGuardado')}:</strong> <span id="cofrinho-guardado">${formatCurrency(totalGuardado)}</span></div>
                            <div><strong>${t('progresso')}:</strong> <span id="cofrinho-progresso">${metaTotal > 0 ? Math.round((totalGuardado / metaTotal) * 100) : 0}%</span></div>
                        </div>
                        <div class="cofrinho-grid" id="cofrinho-grid">
                            ${Array.from({length: Math.min(cells, 100)}, (_, i) => `
                                <div class="cofrinho-cell ${i < Math.round(totalGuardado / (metaTotal / cells)) ? 'completed' : ''}" data-index="${i}" onclick="window.toggleCofrinho(${i})">
                                    ${i + 1}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="card">
                        <p style="color:var(--text-muted);">${t('semPlanejamento')}</p>
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
                <h1 style="font-weight:600;font-size:1.5rem;margin-bottom:20px;">📈 ${t('relatorios')}</h1>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
                    <div class="card">
                        <h3 style="font-size:1rem;margin-bottom:12px;">📊 ${t('receitas')} por Categoria</h3>
                        <div id="report-chart-income" style="height:220px;display:flex;align-items:center;justify-content:center;background:var(--bg-input);border-radius:var(--radius-sm);">
                            <span style="color:var(--text-muted);">${t('carregando')}...</span>
                        </div>
                    </div>
                    <div class="card">
                        <h3 style="font-size:1rem;margin-bottom:12px;">📊 ${t('despesas')} por Categoria</h3>
                        <div id="report-chart-expense" style="height:220px;display:flex;align-items:center;justify-content:center;background:var(--bg-input);border-radius:var(--radius-sm);">
                            <span style="color:var(--text-muted);">${t('carregando')}...</span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h3 style="font-size:1rem;margin-bottom:12px;">📈 ${t('balancoMensal')} Histórico</h3>
                    <div id="report-chart-monthly" style="height:200px;display:flex;align-items:center;justify-content:center;background:var(--bg-input);border-radius:var(--radius-sm);">
                        <span style="color:var(--text-muted);">${t('carregando')}...</span>
                    </div>
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
                <h1 style="font-weight:600;font-size:1.5rem;margin-bottom:20px;">⚙️ ${t('configuracoes')}</h1>

                <div class="card" style="margin-bottom:16px;">
                    <h3 style="font-size:1rem;margin-bottom:12px;">👤 ${t('perfil')}</h3>
                    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                        <div style="width:64px;height:64px;border-radius:50%;background:${state.userFoto ? `url('${state.userFoto}') center/cover` : 'var(--color-purple-bg)'};display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--color-purple);border:3px solid var(--color-purple);">
                            ${state.userFoto ? '' : (state.userFullName ? state.userFullName.charAt(0).toUpperCase() : '👤')}
                        </div>
                        <div>
                            <div><strong>${t('nome')}:</strong> ${state.userFullName || ''}</div>
                            <div><strong>${t('usuario')}:</strong> ${state.user || ''}</div>
                        </div>
                    </div>
                    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="btn-secondary" onclick="window.updateProfile()">✏️ ${t('editar')} ${t('nome')}</button>
                        <button class="btn-secondary" onclick="window.updatePhoto()">🖼️ ${t('alterarFoto')}</button>
                    </div>
                </div>

                <div class="card" style="margin-bottom:16px;">
                    <h3 style="font-size:1rem;margin-bottom:12px;">🔐 ${t('alterarSenha')}</h3>
                    <form id="change-password-form" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div class="form-group">
                            <label>${t('senhaAntiga')}</label>
                            <input type="password" id="old-pass" placeholder="••••••••" required />
                        </div>
                        <div class="form-group">
                            <label>${t('novaSenha')}</label>
                            <input type="password" id="new-pass" placeholder="••••••••" required />
                        </div>
                        <div style="grid-column:1/-1;">
                            <button type="submit" class="btn-primary">${t('alterarSenha')}</button>
                        </div>
                    </form>
                </div>

                <div class="card" style="margin-bottom:16px;">
                    <h3 style="font-size:1rem;margin-bottom:12px;">🎨 ${t('tema')}</h3>
                    <div style="display:flex;gap:8px;">
                        <button class="btn-secondary" onclick="window.applyTheme('light')">☀️ ${t('temaClaro')}</button>
                        <button class="btn-secondary" onclick="window.applyTheme('dark')">🌙 ${t('temaEscuro')}</button>
                    </div>
                </div>

                <div class="card" style="margin-bottom:16px;">
                    <h3 style="font-size:1rem;margin-bottom:12px;">🌐 ${t('idioma')}</h3>
                    <div style="display:flex;gap:8px;">
                        <button class="btn-secondary" onclick="window.setLang('pt')">🇧🇷 Português</button>
                        <button class="btn-secondary" onclick="window.setLang('en')">🇺🇸 English</button>
                    </div>
                </div>

                <div class="card" style="margin-bottom:16px;border-color:var(--color-danger);">
                    <h3 style="font-size:1rem;margin-bottom:12px;color:var(--color-danger);">⚠️ ${t('acoes')} de Conta</h3>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="btn-danger" onclick="window.resetAccount()">🔄 ${t('resetarConta')}</button>
                        <button class="btn-danger" onclick="window.deleteAccount()">🗑️ ${t('excluirConta')}</button>
                        <button class="btn-secondary" onclick="window.doLogout()">🚪 ${t('logout')}</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================
    // EVENT BINDING (após renderização)
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
                        doLogin(user, result.nome, result.foto);
                        showToast(result.boas_vindas || `${t('bemVindo')}, ${result.nome}!`, 'success');
                    } else {
                        showToast('Erro ao fazer login', 'error');
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
                    // Switch to login tab
                    document.querySelector('.login-tabs button[data-tab="login"]')?.click();
                } catch (err) {
                    showToast('Erro ao criar conta: ' + (err.message || ''), 'error');
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
                    showToast('Preencha todos os campos corretamente', 'error');
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
                    await loadMetas();
                    renderView('planejamento');
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

        // Bulk delete
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.onchange = () => {
                document.querySelectorAll('.row-select').forEach(cb => cb.checked = selectAll.checked);
            };
        }
    }

    // ========================================
    // MODAL DE TRANSAÇÃO (criar/editar)
    // ========================================
    function closeTransactionModal() {
        document.getElementById('transaction-modal-overlay')?.remove();
        state.editingTransaction = null;
    }

    function openTransactionModal(id = null) {
        const tx = id ? state.transactions.find(item => String(item.id) === String(id)) : null;
        state.editingTransaction = tx || null;

        const tipoInicial = tx ? tx.tipo : 'despesa';
        const categoriasIniciais = state.categories[tipoInicial] || [];

        const modalHTML = `
            <div class="modal-overlay" id="transaction-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2>${tx ? t('editarTransacao') : t('criarTransacao')}</h2>
                        <button class="modal-close" type="button" onclick="window.closeTransactionModal()">&times;</button>
                    </div>
                    <form id="transaction-form">
                        <div class="form-group">
                            <label>${t('tipo')}</label>
                            <select id="tx-tipo">
                                <option value="despesa" ${tipoInicial === 'despesa' ? 'selected' : ''}>${t('despesas')}</option>
                                <option value="receita" ${tipoInicial === 'receita' ? 'selected' : ''}>${t('receitas')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${t('categoria')}</label>
                            <select id="tx-categoria">
                                ${categoriasIniciais.map(c => `<option value="${c}" ${tx && tx.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>${t('valor')}</label>
                                <input type="text" id="tx-valor" placeholder="R$ 0,00" value="${tx ? formatCurrency(tx.valor) : ''}" oninput="window.maskCurrency(this)" required />
                            </div>
                            <div class="form-group">
                                <label>${t('data')}</label>
                                <input type="date" id="tx-data" value="${tx ? tx.data : todayStr()}" required />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>${t('status')}</label>
                            <select id="tx-status">
                                <option value="pendente" ${tx && tx.status !== 'pago' ? 'selected' : (!tx ? 'selected' : '')}>${t('pendente')}</option>
                                <option value="pago" ${tx && tx.status === 'pago' ? 'selected' : ''}>${t('pago')}</option>
                            </select>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
                            <button type="button" class="btn-secondary" onclick="window.closeTransactionModal()">${t('cancelar')}</button>
                            <button type="submit" class="btn-primary">${t('salvar')}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const overlay = document.getElementById('transaction-modal-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeTransactionModal();
        });

        const tipoSelect = document.getElementById('tx-tipo');
        tipoSelect.addEventListener('change', () => {
            const cats = state.categories[tipoSelect.value] || [];
            document.getElementById('tx-categoria').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
        });

        document.getElementById('transaction-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const tipoVal = document.getElementById('tx-tipo').value;
            const categoriaVal = document.getElementById('tx-categoria').value;
            const valorVal = unmaskCurrency(document.getElementById('tx-valor').value);
            const dataVal = document.getElementById('tx-data').value;
            const statusVal = document.getElementById('tx-status').value;

            if (!categoriaVal || !valorVal || !dataVal) {
                showToast('Preencha todos os campos corretamente', 'error');
                return;
            }

            try {
                if (tx) {
                    await api.atualizarTransacao(state.user, tx.id, tipoVal, categoriaVal, valorVal, dataVal, statusVal);
                    showToast('Transação atualizada!', 'success');
                } else {
                    await api.criarTransacao(state.user, tipoVal, categoriaVal, valorVal, dataVal, statusVal);
                    showToast('Transação criada!', 'success');
                }
                closeTransactionModal();
                await loadTransactions();
                try { state.resumo = await api.getResumo(state.user); } catch (e2) { /* ignore */ }
                renderView('transacoes');
            } catch (err) {
                showToast('Erro: ' + (err.message || ''), 'error');
            }
        });
    }

    // ========================================
    // AÇÕES GLOBAIS EXPORTADAS
    // ========================================
    window.navigate = navigate;
    window.doLogout = doLogout;
    window.applyTheme = applyTheme;
    window.toggleTheme = toggleTheme;
    window.setLang = (lang) => {
        state.lang = lang;
        localStorage.setItem(STORAGE_LANG, lang);
        renderView(state.currentView);
        updateHeaderAuthUI();
        showToast('Idioma alterado!', 'success');
    };
    window.maskCurrency = maskCurrency;
    window.goToPage = (page) => {
        state.currentPage = page;
        renderView('transacoes');
    };
    window.openTransactionModal = openTransactionModal;
    window.closeTransactionModal = closeTransactionModal;
    window.deleteTransaction = async (id) => {
        if (!confirm('Deletar esta transação?')) return;
        try {
            await api.deletarTransacao(state.user, id);
            showToast('Transação deletada!', 'success');
            await loadTransactions();
            renderView('transacoes');
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    };
    window.bulkDelete = async () => {
        const selected = document.querySelectorAll('.row-select:checked');
        if (selected.length === 0) { showToast('Selecione ao menos uma transação', 'error'); return; }
        if (!confirm(`Deletar ${selected.length} transação(ões)?`)) return;
        for (const cb of selected) {
            try {
                await api.deletarTransacao(state.user, cb.dataset.id);
            } catch (e) { /* ignore */ }
        }
        showToast(`${selected.length} transações deletadas!`, 'success');
        await loadTransactions();
        renderView('transacoes');
    };
    window.deleteMeta = async (titulo) => {
        if (!confirm(`Deletar meta "${titulo}"?`)) return;
        try {
            await api.deletarMeta(state.user, titulo);
            showToast('Meta deletada!', 'success');
            await loadMetas();
            renderView('planejamento');
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    };
    window.toggleCofrinho = (index) => {
        const cell = document.querySelector(`.cofrinho-cell[data-index="${index}"]`);
        if (cell) cell.classList.toggle('completed');
        // Recalcular total guardado
        const completed = document.querySelectorAll('.cofrinho-cell.completed').length;
        const total = document.querySelectorAll('.cofrinho-cell').length;
        const meta = state.metas && state.metas.length > 0 ? state.metas[0] : null;
        if (meta && total > 0) {
            const metaTotal = meta.meta;
            const guardado = (completed / total) * metaTotal;
            const guardadoEl = document.getElementById('cofrinho-guardado');
            const progressoEl = document.getElementById('cofrinho-progresso');
            if (guardadoEl) guardadoEl.textContent = formatCurrency(guardado);
            if (progressoEl) progressoEl.textContent = `${metaTotal > 0 ? Math.round((guardado / metaTotal) * 100) : 0}%`;
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
            // Mantém a sessão persistida em sincronia com o novo nome (preservando a foto já salva)
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ usuario: state.user, nome: state.userFullName, foto: state.userFoto || '' }));
            showToast('Perfil atualizado!', 'success');
            renderView('configuracoes');
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    };
    window.updatePhoto = async () => {
        const foto = prompt('URL da sua foto de perfil:', state.userFoto || '');
        if (foto === null) return;
        try {
            await api.atualizarFoto(state.user, foto);
            state.userFoto = foto;
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ usuario: state.user, nome: state.userFullName || '', foto: foto || '' }));
            showToast('Foto atualizada!', 'success');
            renderView('configuracoes');
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    };
    window.resetAccount = async () => {
        if (!confirm('Tem certeza que deseja resetar sua conta? Todos os dados serão apagados.')) return;
        try {
            await api.reiniciarConta(state.user);
            showToast('Conta resetada!', 'success');
            doLogout();
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    };
    window.deleteAccount = async () => {
        if (!confirm('Tem certeza que deseja EXCLUIR sua conta permanentemente? Esta ação é irreversível!')) return;
        try {
            await api.deletarUsuario(state.user);
            showToast('Conta excluída!', 'success');
            doLogout();
        } catch (err) {
            showToast('Erro: ' + (err.message || ''), 'error');
        }
    };

    // ========================================
    // LOADERS DE DADOS
    // ========================================
    async function loadDashboardData() {
        if (!state.user) return;
        try {
            state.resumo = await api.getResumo(state.user);
            state.transactions = await api.listarTransacoes(state.user);
            state.categories = await api.listarCategorias();
            await loadMetas();
        } catch (err) {
            // Se falhar, verificar sessão
            if (err.message?.includes('400') || err.message?.includes('404')) {
                doLogout();
            }
        }
    }

    async function loadTransactions() {
        if (!state.user) return [];
        try {
            state.transactions = await api.listarTransacoes(state.user);
            return state.transactions;
        } catch (err) {
            return [];
        }
    }

    async function loadMetas() {
        if (!state.user) return [];
        try {
            state.metas = await api.listarMetas(state.user);
            return state.metas;
        } catch (err) {
            return [];
        }
    }

    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    document.addEventListener('DOMContentLoaded', async () => {
        // Aplicar tema salvo
        applyTheme(state.theme);

        // Setup PWA
        setupPWAInstall();

        // Eventos de UI
        document.getElementById('menu-toggle')?.addEventListener('click', toggleSidebar);
        document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

        // Fechar sidebar ao clicar fora
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('menu-toggle');
            if (state.isMobile && state.sidebarOpen && sidebar && !sidebar.contains(e.target) && !toggle?.contains(e.target)) {
                closeSidebar();
            }
        });

        // Logout via sidebar
        document.getElementById('sidebar-logout')?.addEventListener('click', doLogout);

        // Router
        window.addEventListener('hashchange', handleHashChange);

        // Inicializar sessão
        await initSession();

        // Atualizar dados em background
        setInterval(async () => {
            if (state.user) {
                try {
                    await api.getResumo(state.user);
                } catch (e) {
                    if (e.message?.includes('400') || e.message?.includes('404')) {
                        doLogout();
                    }
                }
            }
        }, 60000); // a cada 1 minuto
    });

    // ========================================
    // INJEÇÃO DE ESTILOS ADICIONAIS (para toasts)
    // ========================================
    const styleToast = document.createElement('style');
    styleToast.textContent = `
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(40px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 360px;
        }
        @media (max-width: 480px) {
            .toast-container {
                bottom: 16px;
                right: 16px;
                left: 16px;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(styleToast);

    // Expor API para uso no console (debug)
    window.api = api;
    window.state = state;

})();
