// ============ CONFIGURAÇÕES GLOBAIS ============
const API_URL = 'https://nexus-api-mz3t.onrender.com';
const USER_KEY = 'nexus_user';

// Estado global
let currentUser = null;
let currentPage = 1;
let currentTransacoes = [];
let currentMetas = [];
let categories = { receita: [], despesa: [] };
let charts = {};

// ============ UTILIDADES ============
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function getFirstWord(name) {
    return name ? name.split(' ')[0] : '';
}

function showLoading(show = true) {
    const loadingScreen = document.getElementById('loading-screen');
    if (show) {
        loadingScreen.classList.remove('hidden');
    } else {
        loadingScreen.classList.add('hidden');
    }
}

function showToast(message, type = 'success') {
    // Implementar toast notifications
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ============ AUTENTICAÇÃO ============
function checkAuth() {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            verifyUserAccount();
            return true;
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
        }
    }
    return false;
}

async function verifyUserAccount() {
    try {
        const response = await fetch(`${API_URL}/transacoes/resumo?usuario=${currentUser.access_token}`);
        if (!response.ok) {
            throw new Error('Conta não encontrada');
        }
        showMainApp();
    } catch (error) {
        console.error('Erro ao verificar conta:', error);
        logout();
    }
}

function login(usuario, senha) {
    showLoading(true);
    
    fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usuario, senha })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Login falhou');
        }
        return response.json();
    })
    .then(data => {
        currentUser = data;
        localStorage.setItem(USER_KEY, JSON.stringify(data));
        showMainApp();
        showToast('Login realizado com sucesso!');
    })
    .catch(error => {
        console.error('Erro no login:', error);
        showToast('Usuário ou senha incorretos', 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

function register(nome, sobrenome, usuario, senha) {
    showLoading(true);
    
    fetch(`${API_URL}/criar_conta`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nome, sobrenome, usuario, senha })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Registro falhou');
        }
        return response.json();
    })
    .then(() => {
        showToast('Conta criada com sucesso! Faça login.');
        switchAuthTab('login');
    })
    .catch(error => {
        console.error('Erro no registro:', error);
        showToast('Erro ao criar conta', 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

function logout() {
    localStorage.removeItem(USER_KEY);
    currentUser = null;
    showLoginScreen();
}

function showMainApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    loadInitialData();
}

function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
}

function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelector('[data-tab="login"]').classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.querySelector('[data-tab="register"]').classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
}

// ============ API CALLS ============
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
}

function loadInitialData() {
    if (!currentUser) return;
    
    const usuario = currentUser.access_token;
    
    // Carregar resumo
    apiCall(`/transacoes/resumo?usuario=${usuario}`)
        .then(data => {
            updateDashboardSummary(data);
            updateTransacoesSummary(data);
        })
        .catch(error => console.error('Erro ao carregar resumo:', error));
    
    // Carregar categorias
    apiCall('/categorias')
        .then(data => {
            categories = data;
            populateCategorySelects();
        })
        .catch(error => console.error('Erro ao carregar categorias:', error));
    
    // Carregar transações
    loadTransacoes();
    
    // Carregar metas
    loadMetas();
    
    // Atualizar perfil
    updateProfileInfo();
    
    // Carregar relatórios
    loadRelatorios();
}

function updateDashboardSummary(resumo) {
    document.getElementById('saldo-atual').textContent = formatCurrency(resumo.saldo);
    document.getElementById('total-receitas').textContent = formatCurrency(resumo.total_receitas);
    document.getElementById('total-despesas').textContent = formatCurrency(resumo.total_despesas);
}

function updateTransacoesSummary(resumo) {
    document.getElementById('transacoes-saldo').textContent = formatCurrency(resumo.saldo);
    document.getElementById('transacoes-receitas').textContent = formatCurrency(resumo.total_receitas);
    document.getElementById('transacoes-despesas').textContent = formatCurrency(resumo.total_despesas);
}

function updateProfileInfo() {
    if (!currentUser) return;
    
    const greeting = document.getElementById('greeting');
    const userNameHeader = document.getElementById('user-name-header');
    const userPhoto = document.getElementById('user-photo');
    const configUserPhoto = document.getElementById('config-user-photo');
    const updateNome = document.getElementById('update-nome');
    const updateSobrenome = document.getElementById('update-sobrenome');
    
    if (currentUser.nome) {
        greeting.textContent = `Olá, ${getFirstWord(currentUser.nome)}!`;
        userNameHeader.textContent = currentUser.nome;
        
        const [nome, ...sobrenome] = currentUser.nome.split(' ');
        updateNome.value = nome || '';
        updateSobrenome.value = sobrenome.join(' ') || '';
    }
    
    if (currentUser.foto && currentUser.foto !== 'null') {
        userPhoto.src = `data:image/jpeg;base64,${currentUser.foto}`;
        configUserPhoto.src = `data:image/jpeg;base64,${currentUser.foto}`;
    }
}

// ============ TRANSAÇÕES ============
function loadTransacoes(page = 1) {
    if (!currentUser) return;
    
    const usuario = currentUser.access_token;
    currentPage = page;
    
    apiCall(`/transacoes/listar?usuario=${usuario}`)
        .then(transacoes => {
            currentTransacoes = transacoes;
            displayTransacoes();
        })
        .catch(error => console.error('Erro ao carregar transações:', error));
}

function displayTransacoes() {
    const listContainer = document.getElementById('transacoes-list');
    const paginationContainer = document.getElementById('pagination');
    
    // Paginação
    const itemsPerPage = 10;
    const totalPages = Math.ceil(currentTransacoes.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = currentTransacoes.slice(startIndex, endIndex);
    
    // Renderizar lista
    if (pageItems.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Nenhuma transação encontrada.</p>';
    } else {
        listContainer.innerHTML = pageItems.map(transacao => {
            const isReceita = transacao.tipo === 'receita';
            const statusClass = transacao.status === 'pendente' ? 'pendente' : 'efetuada';
            const statusIcon = transacao.status === 'pendente' ? '!' : '✓';
            
            return `
                <div class="transacao-item" data-id="${transacao.id || transacao.transacao_id}">
                    <input type="checkbox" class="transacao-checkbox">
                    <div class="transacao-status-icon status-${statusClass}">${statusIcon}</div>
                    <div class="transacao-info">
                        <div class="transacao-categoria">${transacao.categoria}</div>
                        <div class="transacao-data">${formatDate(transacao.data)}</div>
                    </div>
                    <div class="transacao-valor ${isReceita ? 'valor-receita' : 'valor-despesa'}">
                        ${isReceita ? '+' : '-'} ${formatCurrency(transacao.valor)}
                    </div>
                    <div class="transacao-menu">
                        <button class="transacao-menu-btn">⋯</button>
                        <div class="transacao-menu-content">
                            <button class="transacao-menu-item edit-transacao">Editar</button>
                            <button class="transacao-menu-item delete-transacao">Deletar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Adicionar event listeners
        document.querySelectorAll('.transacao-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = btn.nextElementSibling;
                menu.classList.toggle('active');
            });
        });
        
        document.querySelectorAll('.edit-transacao').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.transacao-item');
                const transacaoId = item.dataset.id;
                const transacao = currentTransacoes.find(t => (t.id || t.transacao_id) == transacaoId);
                if (transacao) {
                    editTransacao(transacao);
                }
            });
        });
        
        document.querySelectorAll('.delete-transacao').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.transacao-item');
                const transacaoId = item.dataset.id;
                deleteTransacao(transacaoId);
            });
        });
    }
    
    // Renderizar paginação
    if (totalPages > 1) {
        paginationContainer.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                currentPage = i;
                displayTransacoes();
            });
            paginationContainer.appendChild(btn);
        }
    } else {
        paginationContainer.innerHTML = '';
    }
}

function createTransacao(transacaoData) {
    if (!currentUser) return;
    
    transacaoData.usuario = currentUser.access_token;
    
    apiCall('/transacoes/criar', 'POST', transacaoData)
        .then(() => {
            showToast('Transação criada com sucesso!');
            loadTransacoes();
            loadInitialData();
        })
        .catch(error => {
            console.error('Erro ao criar transação:', error);
            showToast('Erro ao criar transação', 'error');
        });
}

function updateTransacao(transacaoData) {
    if (!currentUser) return;
    
    transacaoData.usuario = currentUser.access_token;
    
    apiCall('/transacoes/atualizar', 'PUT', transacaoData)
        .then(() => {
            showToast('Transação atualizada com sucesso!');
            loadTransacoes();
            loadInitialData();
        })
        .catch(error => {
            console.error('Erro ao atualizar transação:', error);
            showToast('Erro ao atualizar transação', 'error');
        });
}

function deleteTransacao(transacaoId) {
    if (!currentUser) return;
    
    if (confirm('Tem certeza que deseja deletar esta transação?')) {
        apiCall('/transacoes/deletar', 'DELETE', {
            usuario: currentUser.access_token,
            transacao_id: transacaoId
        })
        .then(() => {
            showToast('Transação deletada com sucesso!');
            loadTransacoes();
            loadInitialData();
        })
        .catch(error => {
            console.error('Erro ao deletar transação:', error);
            showToast('Erro ao deletar transação', 'error');
        });
    }
}

function editTransacao(transacao) {
    const modal = document.getElementById('transacao-modal');
    const form = document.getElementById('transacao-form');
    
    document.getElementById('transacao-modal-title').textContent = 'Editar Transação';
    document.getElementById('transacao-id').value = transacao.id || transacao.transacao_id;
    document.getElementById('transacao-tipo').value = transacao.tipo;
    document.getElementById('transacao-categoria').value = transacao.categoria;
    document.getElementById('transacao-valor').value = transacao.valor;
    document.getElementById('transacao-data').value = transacao.data;
    document.getElementById('transacao-status').value = transacao.status;
    
    populateCategorySelects(transacao.tipo);
    modal.classList.remove('hidden');
}

function populateCategorySelects(tipo = null) {
    const categorySelect = document.getElementById('transacao-categoria');
    const tipoSelect = document.getElementById('transacao-tipo');
    
    if (!tipo) {
        tipo = tipoSelect.value;
    }
    
    const categoriesList = categories[tipo] || [];
    categorySelect.innerHTML = categoriesList.map(cat => 
        `<option value="${cat}">${cat}</option>`
    ).join('');
}

// ============ METAS ============
function loadMetas() {
    if (!currentUser) return;
    
    const usuario = currentUser.access_token;
    
    apiCall(`/metas/listar?usuario=${usuario}`)
        .then(metas => {
            currentMetas = metas;
            displayMetas();
        })
        .catch(error => console.error('Erro ao carregar metas:', error));
}

function displayMetas() {
    const metasGrid = document.getElementById('metas-grid');
    
    if (!currentMetas || currentMetas.length === 0) {
        metasGrid.innerHTML = '<p>Nenhuma meta definida.</p>';
        document.getElementById('planejamento-preview').innerHTML = 
            '<p>Opa! Você ainda não possui um planejamento definido para este mês.</p>' +
            '<button class="btn-primary" data-page="planejamento">Definir meu planejamento</button>';
        return;
    }
    
    // Atualizar preview no dashboard
    const metaAtual = currentMetas[0];
    const metaValor = (metaAtual.salario_liquido * metaAtual.porcentagem_meta) / 100;
    document.getElementById('planejamento-preview').innerHTML = `
        <p>Meta: ${metaAtual.titulo}</p>
        <p>Valor: ${formatCurrency(metaValor)}</p>
        <p>Progresso: ${metaAtual.porcentagem_meta}%</p>
    `;
    
    // Mostrar grid
    metasGrid.innerHTML = currentMetas.map(meta => {
        const metaValor = (meta.salario_liquido * meta.porcentagem_meta) / 100;
        const partes = Math.ceil(metaValor / 100); // Cada quadrado vale R$ 100
        const squares = Array(partes).fill(null).map((_, i) => {
            return `<div class="meta-square" data-index="${i}" data-valor="${metaValor / partes}">
                ${formatCurrency(metaValor / partes)}
            </div>`;
        }).join('');
        
        return `
            <div class="meta-card">
                <h3>${meta.titulo}</h3>
                <p>Salário: ${formatCurrency(meta.salario_liquido)}</p>
                <p>Meta: ${meta.porcentagem_meta}%</p>
                <div class="metas-grid">${squares}</div>
                <button class="btn-secondary edit-meta" data-titulo="${meta.titulo}">Editar</button>
                <button class="btn-danger delete-meta" data-titulo="${meta.titulo}">Excluir</button>
            </div>
        `;
    }).join('');
    
    // Adicionar event listeners
    document.querySelectorAll('.meta-square').forEach(square => {
        square.addEventListener('click', () => {
            square.classList.toggle('completed');
            updatePlanejamentoResumo();
        });
    });
}

function createMeta(metaData) {
    if (!currentUser) return;
    
    metaData.usuario = currentUser.access_token;
    
    apiCall('/metas/criar', 'POST', metaData)
        .then(() => {
            showToast('Meta criada com sucesso!');
            loadMetas();
        })
        .catch(error => {
            console.error('Erro ao criar meta:', error);
            showToast('Erro ao criar meta', 'error');
        });
}

function updatePlanejamentoResumo() {
    const completedSquares = document.querySelectorAll('.meta-square.completed');
    const totalSquares = document.querySelectorAll('.meta-square');
    
    const totalGuardado = Array.from(completedSquares).reduce((sum, square) => {
        return sum + parseFloat(square.dataset.valor);
    }, 0);
    
    const metaTotal = Array.from(totalSquares).reduce((sum, square) => {
        return sum + parseFloat(square.dataset.valor);
    }, 0);
    
    document.getElementById('total-guardado').textContent = formatCurrency(totalGuardado);
    document.getElementById('meta-total').textContent = formatCurrency(metaTotal);
}

// ============ RELATÓRIOS ============
function loadRelatorios() {
    if (!currentUser) return;
    
    const usuario = currentUser.access_token;
    
    // Carregar resumo para gráficos
    apiCall(`/transacoes/resumo?usuario=${usuario}`)
        .then(resumo => {
            createCharts(resumo);
        })
        .catch(error => console.error('Erro ao carregar relatórios:', error));
}

function createCharts(resumo) {
    // Destruir charts existentes
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    // Receitas por categoria
    const receitaCtx = document.getElementById('receitas-chart');
    const despesaCtx = document.getElementById('despesas-chart');
    const balancoCtx = document.getElementById('balanco-chart');
    const relatorioReceitasCtx = document.getElementById('relatorio-receitas-chart');
    const relatorioDespesasCtx = document.getElementById('relatorio-despesas-chart');
    const relatorioBalancoCtx = document.getElementById('relatorio-balanco-chart');
    
    if (receitaCtx && resumo.resumo_categoria) {
        const receitaCategories = Object.entries(resumo.resumo_categoria)
            .filter(([cat, data]) => data.receitas > 0);
        
        if (receitaCategories.length > 0) {
            charts.receitas = new Chart(receitaCtx, {
                type: 'doughnut',
                data: {
                    labels: receitaCategories.map(([cat]) => cat),
                    datasets: [{
                        data: receitaCategories.map(([, data]) => data.receitas),
                        backgroundColor: ['#9B59B6', '#E07B7B', '#F1C40F', '#2ECC71', '#3498DB', '#95A5A6'],
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                }
            });
            
            if (relatorioReceitasCtx) {
                charts.relatorioReceitas = new Chart(relatorioReceitasCtx, {
                    type: 'doughnut',
                    data: {
                        labels: receitaCategories.map(([cat]) => cat),
                        datasets: [{
                            data: receitaCategories.map(([, data]) => data.receitas),
                            backgroundColor: ['#9B59B6', '#E07B7B', '#F1C40F', '#2ECC71', '#3498DB', '#95A5A6'],
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                    }
                });
            }
        }
        
        const despesaCategories = Object.entries(resumo.resumo_categoria)
            .filter(([cat, data]) => data.despesas > 0);
        
        if (despesaCategories.length > 0) {
            charts.despesas = new Chart(despesaCtx, {
                type: 'doughnut',
                data: {
                    labels: despesaCategories.map(([cat]) => cat),
                    datasets: [{
                        data: despesaCategories.map(([, data]) => data.despesas),
                        backgroundColor: ['#3498DB', '#F39C12', '#E74C3C', '#9B59B6', '#95A5A6', '#7F8C8D'],
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                }
            });
            
            if (relatorioDespesasCtx) {
                charts.relatorioDespesas = new Chart(relatorioDespesasCtx, {
                    type: 'doughnut',
                    data: {
                        labels: despesaCategories.map(([cat]) => cat),
                        datasets: [{
                            data: despesaCategories.map(([, data]) => data.despesas),
                            backgroundColor: ['#3498DB', '#F39C12', '#E74C3C', '#9B59B6', '#95A5A6', '#7F8C8D'],
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                    }
                });
            }
        }
    }
}

// ============ NAVEGAÇÃO ============
function navigateTo(page) {
    // Atualizar sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Atualizar páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');
    
    // Fechar sidebar no mobile
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('expanded');
    }
}

// ============ EVENT LISTENERS ============
document.addEventListener('DOMContentLoaded', () => {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchAuthTab(tab.dataset.tab);
        });
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const usuario = document.getElementById('login-usuario').value;
        const senha = document.getElementById('login-senha').value;
        login(usuario, senha);
    });
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = document.getElementById('reg-nome').value;
        const sobrenome = document.getElementById('reg-sobrenome').value;
        const usuario = document.getElementById('reg-usuario').value;
        const senha = document.getElementById('reg-senha').value;
        register(nome, sobrenome, usuario, senha);
    });
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            navigateTo(item.dataset.page);
        });
    });
    
    document.querySelectorAll('.header-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.page) {
                navigateTo(btn.dataset.page);
            }
        });
    });
    
    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('expanded');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });
    
    // User info click
    document.querySelector('.user-info').addEventListener('click', () => {
        navigateTo('configuracoes');
    });
    
    // Transações
    document.getElementById('nova-transacao-btn').addEventListener('click', () => {
        document.getElementById('transacao-modal-title').textContent = 'Nova Transação';
        document.getElementById('transacao-form').reset();
        document.getElementById('transacao-id').value = '';
        populateCategorySelects();
        document.getElementById('transacao-modal').classList.remove('hidden');
    });
    
    document.getElementById('cancel-transacao').addEventListener('click', () => {
        document.getElementById('transacao-modal').classList.add('hidden');
    });
    
    document.getElementById('transacao-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const transacaoData = {
            tipo: document.getElementById('transacao-tipo').value,
            categoria: document.getElementById('transacao-categoria').value,
            valor: parseFloat(document.getElementById('transacao-valor').value),
            data: document.getElementById('transacao-data').value,
            status: document.getElementById('transacao-status').value,
        };
        
        const transacaoId = document.getElementById('transacao-id').value;
        if (transacaoId) {
            transacaoData.transacao_id = transacaoId;
            updateTransacao(transacaoData);
        } else {
            createTransacao(transacaoData);
        }
        
        document.getElementById('transacao-modal').classList.add('hidden');
    });
    
    document.getElementById('transacao-tipo').addEventListener('change', () => {
        populateCategorySelects();
    });
    
    // Select all transações
    document.getElementById('select-all-transacoes').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.transacao-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateDeleteSelectedButton();
    });
    
    // Delete selected
    document.getElementById('delete-selected').addEventListener('click', () => {
        const selectedCheckboxes = document.querySelectorAll('.transacao-checkbox:checked');
        if (selectedCheckboxes.length === 0) return;
        
        if (confirm(`Deletar ${selectedCheckboxes.length} transações selecionadas?`)) {
            selectedCheckboxes.forEach(cb => {
                const transacaoId = cb.closest('.transacao-item').dataset.id;
                deleteTransacao(transacaoId);
            });
        }
    });
    
    // Meta form
    document.getElementById('meta-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const metaData = {
            titulo: document.getElementById('meta-titulo').value,
            salario_liquido: parseFloat(document.getElementById('meta-salario').value),
            porcentagem_meta: parseFloat(document.getElementById('meta-porcentagem').value),
        };
        createMeta(metaData);
        e.target.reset();
    });
    
    // Update profile
    document.getElementById('update-profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        
        const nome = document.getElementById('update-nome').value;
        const sobrenome = document.getElementById('update-sobrenome').value;
        
        apiCall('/atualizar_nome_sobrenome', 'PUT', {
            usuario: currentUser.access_token,
            nome,
            sobrenome
        })
        .then(() => {
            currentUser.nome = `${nome} ${sobrenome}`;
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
            updateProfileInfo();
            showToast('Perfil atualizado com sucesso!');
        })
        .catch(error => {
            console.error('Erro ao atualizar perfil:', error);
            showToast('Erro ao atualizar perfil', 'error');
        });
    });
    
    // Change password
    document.getElementById('change-password-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        
        const senha_antiga = document.getElementById('senha-antiga').value;
        const nova_senha = document.getElementById('nova-senha').value;
        
        apiCall('/atualizar_senha', 'PUT', {
            usuario: currentUser.access_token,
            senha_antiga,
            nova_senha
        })
        .then(() => {
            showToast('Senha alterada com sucesso!');
            e.target.reset();
        })
        .catch(error => {
            console.error('Erro ao alterar senha:', error);
            showToast('Erro ao alterar senha', 'error');
        });
    });
    
    // Upload photo
    document.getElementById('upload-photo-btn').addEventListener('click', () => {
        const fileInput = document.getElementById('photo-upload');
        if (fileInput.files.length === 0) {
            showToast('Selecione uma imagem primeiro', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            
            apiCall('/atualizar_foto', 'PUT', {
                usuario: currentUser.access_token,
                foto: base64
            })
            .then(() => {
                currentUser.foto = base64;
                localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
                updateProfileInfo();
                showToast('Foto atualizada com sucesso!');
            })
            .catch(error => {
                console.error('Erro ao atualizar foto:', error);
                showToast('Erro ao atualizar foto', 'error');
            });
        };
        
        reader.readAsDataURL(file);
    });
    
    // Language select
    document.getElementById('language-select').addEventListener('change', (e) => {
        const language = e.target.value;
        // Implementar tradução
        showToast(`Idioma alterado para ${language}`);
    });
    
    // Theme select
    document.getElementById('theme-select').addEventListener('change', (e) => {
        const theme = e.target.value;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('nexus_theme', theme);
    });
    
    // Reset account
    document.getElementById('reset-account-btn').addEventListener('click', () => {
        if (!currentUser) return;
        if (confirm('Tem certeza que deseja resetar sua conta? Todos os dados serão apagados.')) {
            apiCall(`/reiniciar_conta?usuario=${currentUser.access_token}`, 'DELETE')
                .then(() => {
                    showToast('Conta resetada com sucesso!');
                    loadInitialData();
                })
                .catch(error => {
                    console.error('Erro ao resetar conta:', error);
                    showToast('Erro ao resetar conta', 'error');
                });
        }
    });
    
    // Delete account
    document.getElementById('delete-account-btn').addEventListener('click', () => {
        if (!currentUser) return;
        if (confirm('Tem certeza que deseja excluir sua conta permanentemente?')) {
            apiCall(`/deletar_usuario?usuario=${currentUser.access_token}`, 'DELETE')
                .then(() => {
                    showToast('Conta excluída com sucesso!');
                    logout();
                })
                .catch(error => {
                    console.error('Erro ao excluir conta:', error);
                    showToast('Erro ao excluir conta', 'error');
                });
        }
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Deseja sair?')) {
            logout();
        }
    });
    
    // PWA Install
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('pwa-install-btn').classList.remove('hidden');
    });
    
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === 'accepted') {
                showToast('App instalado com sucesso!');
            }
            deferredPrompt = null;
        }
    });
    
    // Fechar menus ao clicar fora
    document.addEventListener('click', () => {
        document.querySelectorAll('.transacao-menu-content').forEach(menu => {
            menu.classList.remove('active');
        });
    });
    
    // Inicializar tema
    const savedTheme = localStorage.getItem('nexus_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-select').value = savedTheme;
    
    // Verificar autenticação
    if (checkAuth()) {
        showMainApp();
    } else {
        showLoginScreen();
    }
    
    showLoading(false);
});

// Atualizar botão de deletar selecionadas
function updateDeleteSelectedButton() {
    const selectedCheckboxes = document.querySelectorAll('.transacao-checkbox:checked');
    const deleteBtn = document.getElementById('delete-selected');
    if (selectedCheckboxes.length > 0) {
        deleteBtn.classList.remove('hidden');
        deleteBtn.textContent = `Excluir ${selectedCheckboxes.length} Selecionadas`;
    } else {
        deleteBtn.classList.add('hidden');
    }
}

// Adicionar listener global para checkboxes
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('transacao-checkbox')) {
        updateDeleteSelectedButton();
    }
});
