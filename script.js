const API_BASE = "https://nexus-api-mz3t.onrender.com";
let currentUser = localStorage.getItem("nexus_user") || null;
let currentLang = localStorage.getItem("nexus_lang") || "pt-BR";
let currentTheme = localStorage.getItem("nexus_theme") || "light";
let globalCategories = { receita: [], despesa: [] };
let allTransactions = [];
let currentPage = 1;
const itemsPerPage = 10;
let deferredPrompt = null;

// Dicionário de Internacionalização (PT-BR / EN)
const i18n = {
    "pt-BR": {
        nav_home: "Início", nav_login: "Fazer Login", nav_download: "Download App",
        auth_tab_login: "Entrar", auth_tab_register: "Cadastrar Nova Conta",
        label_usuario: "Usuário", label_senha: "Senha", label_nome: "Nome", label_sobrenome: "Sobrenome",
        btn_entrar: "Entrar", btn_cadastrar: "Criar Conta",
        menu_dashboard: "Dashboard", menu_transacoes: "Transações", menu_planejamento: "Planejamento",
        menu_relatorios: "Relatórios", menu_configuracoes: "Configurações",
        card_saldo: "Saldo Atual", card_receitas: "Receitas", card_despesas: "Despesas",
        chart_rec_cat: "Receitas por Categoria", chart_esp_cat: "Despesas por Categoria",
        card_balanco: "Balanço Mensal", card_planejamento: "Planejamento",
        btn_ver_mais: "Ver mais →", btn_definir_plano: "Definir meu planejamento",
        btn_nova_transacao: "+ Nova Transação", btn_excluir_selecionados: "Excluir Selecionados",
        th_data: "Data", th_tipo: "Tipo", th_categoria: "Categoria", th_valor: "Valor", th_status: "Situação", th_acoes: "Ações",
        title_config_meta: "Configurar Meta Mensal", label_titulo_meta: "Título da Meta",
        label_salario_liquido: "Salário Líquido (R$)", label_porcentagem_meta: "Porcentagem da Meta (%)",
        btn_salvar_meta: "Salvar Meta", btn_excluir_meta: "Excluir Meta", title_desafio_cofrinho: "Desafio do Cofrinho",
        label_guardado: "Guardado:", label_meta_total: "Meta Total:", msg_sem_meta: "Cadastre uma meta para ativar os quadradinhos do cofrinho.",
        title_historico_balanco: "Balanço Histórico (Últimos Meses)", title_perfil: "Meu Perfil",
        btn_alterar_foto: "Alterar Foto", btn_atualizar_perfil: "Atualizar Perfil", title_preferencias: "Preferências",
        label_idioma: "Idioma", label_tema: "Tema", theme_light: "Claro", theme_dark: "Escuro",
        title_seguranca: "Segurança & Senha", label_senha_antiga: "Senha Antiga", label_nova_senha: "Nova Senha",
        btn_alterar_senha: "Alterar Senha", title_zona_perigo: "Zona de Perigo", btn_reiniciar_conta: "Reiniciar Conta",
        btn_excluir_conta: "Excluir Conta Permanentemente", btn_sair: "Sair (Logout)",
        title_nova_transacao: "Nova Transação", label_tipo: "Tipo", label_categoria: "Categoria",
        label_valor: "Valor (R$)", label_data: "Data (DD/MM/AAAA)", label_status: "Situação",
        opt_receita: "Receita", opt_despesa: "Despesa", opt_efetuada: "Efetuada", opt_pendente: "Pendente", btn_salvar: "Salvar Transação"
    },
    "en": {
        nav_home: "Home", nav_login: "Login", nav_download: "Download App",
        auth_tab_login: "Login", auth_tab_register: "Sign Up",
        label_usuario: "Username", label_senha: "Password", label_nome: "First Name", label_sobrenome: "Last Name",
        btn_entrar: "Sign In", btn_cadastrar: "Create Account",
        menu_dashboard: "Dashboard", menu_transacoes: "Transactions", menu_planejamento: "Planning",
        menu_relatorios: "Reports", menu_configuracoes: "Settings",
        card_saldo: "Current Balance", card_receitas: "Incomes", card_despesas: "Expenses",
        chart_rec_cat: "Incomes by Category", chart_esp_cat: "Expenses by Category",
        card_balanco: "Monthly Balance", card_planejamento: "Planning",
        btn_ver_mais: "View more →", btn_definir_plano: "Define my plan",
        btn_nova_transacao: "+ New Transaction", btn_excluir_selecionados: "Delete Selected",
        th_data: "Date", th_tipo: "Type", th_categoria: "Category", th_valor: "Amount", th_status: "Status", th_acoes: "Actions",
        title_config_meta: "Configure Monthly Goal", label_titulo_meta: "Goal Title",
        label_salario_liquido: "Net Salary ($)", label_porcentagem_meta: "Goal Percentage (%)",
        btn_salvar_meta: "Save Goal", btn_excluir_meta: "Delete Goal", title_desafio_cofrinho: "Piggy Bank Challenge",
        label_guardado: "Saved:", label_meta_total: "Total Goal:", msg_sem_meta: "Register a goal to activate piggy bank boxes.",
        title_historico_balanco: "Historical Balance", title_perfil: "My Profile",
        btn_alterar_foto: "Change Photo", btn_atualizar_perfil: "Update Profile", title_preferencias: "Preferences",
        label_idioma: "Language", label_tema: "Theme", theme_light: "Light", theme_dark: "Dark",
        title_seguranca: "Security & Password", label_senha_antiga: "Old Password", label_nova_senha: "New Password",
        btn_alterar_senha: "Change Password", title_zona_perigo: "Danger Zone", btn_reiniciar_conta: "Restart Account",
        btn_excluir_conta: "Delete Account Permanently", btn_sair: "Logout",
        title_nova_transacao: "New Transaction", label_tipo: "Type", label_categoria: "Category",
        label_valor: "Amount ($)", label_data: "Date (DD/MM/YYYY)", label_status: "Status",
        opt_receita: "Income", opt_despesa: "Expense", opt_efetuada: "Completed", opt_pendente: "Pending", btn_salvar: "Save Transaction"
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    initThemeAndLang();
    initMoneyMasks();
    initPWA();
    setupEventListeners();

    // Verificação de Sessão Permanente & Integridade
    if (currentUser) {
        try {
            const res = await fetch(`${API_BASE}/transacoes/resumo?usuario=${encodeURIComponent(currentUser)}`);
            if (!res.ok) throw new Error("Sessão inválida");
            enterAppDashboard();
        } catch (e) {
            localStorage.removeItem("nexus_user");
            currentUser = null;
            showAuthView();
        }
    } else {
        showAuthView();
    }
});

/* --- Internacionalização e Temas --- */
function initThemeAndLang() {
    document.documentElement.setAttribute("data-theme", currentTheme);
    document.getElementById("select-theme").value = currentTheme;
    document.getElementById("select-language").value = currentLang;
    applyTranslations();
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (i18n[currentLang][key]) {
            el.textContent = i18n[currentLang][key];
        }
    });
}

/* --- Máscara de Dinheiro --- */
function initMoneyMasks() {
    document.querySelectorAll(".money-mask").forEach(input => {
        input.addEventListener("input", (e) => {
            let value = e.target.value.replace(/\D/g, "");
            value = (Number(value) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            e.target.value = value;
        });
    });
}

function parseMoneyToFloat(valStr) {
    if (!valStr) return 0.0;
    return parseFloat(valStr.replace(/\./g, "").replace(",", ".")) || 0.0;
}

function formatMoney(num) {
    return (num || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* --- Conversão de Data BR <-> ISO --- */
function dateBrToIso(dateBr) {
    const parts = dateBr.split("/");
    if (parts.length !== 3) return dateBr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function dateIsoToBr(dateIso) {
    if (!dateIso) return "";
    const parts = dateIso.split("-");
    if (parts.length !== 3) return dateIso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/* --- Event Listeners Globais --- */
function setupEventListeners() {
    // Abas de Auth
    document.querySelectorAll(".auth-tabs .tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".auth-tabs .tab-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            const tab = e.target.getAttribute("data-tab");
            if (tab === "login") {
                document.getElementById("form-login").hidden = false;
                document.getElementById("form-register").hidden = true;
            } else {
                document.getElementById("form-login").hidden = true;
                document.getElementById("form-register").hidden = false;
            }
        });
    });

    // Login Submit
    document.getElementById("form-login").addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Erro ao logar");
            currentUser = formData.usuario;
            localStorage.setItem("nexus_user", currentUser);
            enterAppDashboard();
        } catch (err) {
            alert(err.message);
        }
    });

    // Cadastro Submit
    document.getElementById("form-register").addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        try {
            const res = await fetch(`${API_BASE}/criar_conta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Erro ao cadastrar");
            currentUser = formData.usuario;
            localStorage.setItem("nexus_user", currentUser);
            enterAppDashboard();
        } catch (err) {
            alert(err.message);
        }
    });

    // Navegação Sidebar e Links
    document.querySelectorAll(".sidebar-item, .navigate-link").forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const target = item.getAttribute("data-target") || item.getAttribute("href").substring(1);
            switchView(target);
            if (window.innerWidth <= 768) {
                document.getElementById("app-sidebar").classList.remove("open");
            }
        });
    });

    // Menu Mobile Hambúrguer
    document.getElementById("menu-toggle").addEventListener("click", () => {
        document.getElementById("app-sidebar").classList.toggle("open");
    });

    // Configurações: Tema e Idioma
    document.getElementById("select-theme").addEventListener("change", (e) => {
        currentTheme = e.target.value;
        localStorage.setItem("nexus_theme", currentTheme);
        document.documentElement.setAttribute("data-theme", currentTheme);
    });

    document.getElementById("select-language").addEventListener("change", (e) => {
        currentLang = e.target.value;
        localStorage.setItem("nexus_lang", currentLang);
        applyTranslations();
    });

    // Logout
    document.getElementById("btn-logout").addEventListener("click", () => {
        localStorage.removeItem("nexus_user");
        currentUser = null;
        showAuthView();
    });

    // Transações Modal & Formulário
    document.getElementById("btn-open-trans-modal").addEventListener("click", () => openTransModal());
    document.getElementById("btn-close-trans-modal").addEventListener("click", () => document.getElementById("modal-transacao").hidden = true);
    document.getElementById("trans-tipo-select").addEventListener("change", (e) => populateCategorySelect(e.target.value));

    document.getElementById("form-transacao").addEventListener("submit", async (e) => {
        e.preventDefault();
        const transId = document.getElementById("trans-id-hidden").value;
        const rawValor = parseMoneyToFloat(document.getElementById("trans-valor-input").value);
        const rawData = dateBrToIso(document.getElementById("trans-data-input").value);
        
        const payload = {
            usuario: currentUser,
            tipo: document.getElementById("trans-tipo-select").value,
            categoria: document.getElementById("trans-cat-select").value,
            valor: rawValor,
            data: rawData,
            status: document.getElementById("trans-status-select").value
        };

        try {
            let res;
            if (transId) {
                payload.transacao_id = transId;
                res = await fetch(`${API_BASE}/transacoes/atualizar`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch(`${API_BASE}/transacoes/criar`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            }
            if (!res.ok) throw new Error("Erro ao salvar transação");
            document.getElementById("modal-transacao").hidden = true;
            loadTransactionsPage();
            loadDashboardData();
        } catch (err) {
            alert(err.message);
        }
    });

    // Meta / Planejamento Submit
    document.getElementById("form-meta").addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        formData.usuario = currentUser;
        formData.salario_liquido = parseMoneyToFloat(formData.salario_liquido);
        formData.porcentagem_meta = Number(formData.porcentagem_meta);

        try {
            const res = await fetch(`${API_BASE}/metas/criar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (!res.ok) throw new Error("Erro ao salvar meta");
            alert("Meta salva com sucesso!");
            loadPlanningData();
        } catch (err) {
            alert(err.message);
        }
    });

    // Excluir Meta
    document.getElementById("btn-delete-meta").addEventListener("click", async () => {
        const titulo = document.querySelector("#form-meta input[name='titulo']").value;
        if (!confirm("Deseja realmente excluir esta meta?")) return;
        try {
            const res = await fetch(`${API_BASE}/metas/deletar?usuario=${encodeURIComponent(currentUser)}&titulo=${encodeURIComponent(titulo)}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Erro ao excluir meta");
            loadPlanningData();
        } catch (err) {
            alert(err.message);
        }
    });

    // Perfil Update
    document.getElementById("form-update-profile").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = document.getElementById("config-input-nome").value;
        const sobrenome = document.getElementById("config-input-sobrenome").value;
        try {
            const res = await fetch(`${API_BASE}/atualizar_nome_sobrenome`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario: currentUser, nome, sobrenome })
            });
            if (!res.ok) throw new Error("Erro ao atualizar perfil");
            alert("Perfil atualizado!");
            loadUserProfile();
        } catch (err) {
            alert(err.message);
        }
    });

    // Senha Update
    document.getElementById("form-update-password").addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        formData.usuario = currentUser;
        try {
            const res = await fetch(`${API_BASE}/atualizar_senha`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (!res.ok) throw new Error("Senha antiga incorreta ou erro ao atualizar");
            alert("Senha alterada com sucesso!");
            e.target.reset();
        } catch (err) {
            alert(err.message);
        }
    });

    // Reiniciar & Excluir Conta
    document.getElementById("btn-restart-account").addEventListener("click", async () => {
        if (!confirm("Tem certeza que deseja reiniciar sua conta (apagar transações/metas)?")) return;
        try {
            const res = await fetch(`${API_BASE}/reiniciar_conta?usuario=${encodeURIComponent(currentUser)}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Erro ao reiniciar conta");
            alert("Conta reiniciada com sucesso.");
            loadDashboardData();
        } catch (err) { alert(err.message); }
    });

    document.getElementById("btn-delete-account").addEventListener("click", async () => {
        if (!confirm("ATENÇÃO: Deseja excluir permanentemente sua conta? Esta ação é irreversível.")) return;
        try {
            const res = await fetch(`${API_BASE}/deletar_usuario?usuario=${encodeURIComponent(currentUser)}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Erro ao deletar conta");
            localStorage.removeItem("nexus_user");
            currentUser = null;
            showAuthView();
        } catch (err) { alert(err.message); }
    });

    // Checkbox master transações
    document.getElementById("select-all-trans").addEventListener("change", (e) => {
        const checked = e.target.checked;
        document.querySelectorAll(".trans-checkbox").forEach(cb => {
            cb.checked = checked;
        });
        updateBulkDeleteButton();
    });

    document.getElementById("btn-delete-selected").addEventListener("click", async () => {
        const selected = Array.from(document.querySelectorAll(".trans-checkbox:checked")).map(cb => cb.getAttribute("data-id"));
        if (!selected.length || !confirm(`Deseja excluir ${selected.length} transações?`)) return;
        
        for (const id of selected) {
            await fetch(`${API_BASE}/transacoes/deletar`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario: currentUser, transacao_id: id })
            });
        }
        loadTransactionsPage();
        loadDashboardData();
    });
}

/* --- Transição de Views e Estado Logado --- */
function showAuthView() {
    document.getElementById("global-header").querySelector(".header-brand").hidden = false;
    document.getElementById("header-public-actions").hidden = false;
    document.getElementById("header-private-actions").hidden = true;
    document.getElementById("app-sidebar").hidden = true;
    document.querySelectorAll(".view").forEach(v => v.hidden = true);
    document.getElementById("view-auth").hidden = false;
    document.getElementById("view-auth").classList.add("active-view");
}

async function enterAppDashboard() {
    document.getElementById("header-public-actions").hidden = true;
    document.getElementById("header-private-actions").hidden = false;
    document.getElementById("app-sidebar").hidden = false;
    document.getElementById("menu-toggle").hidden = false;
    
    await fetchCategories();
    await loadUserProfile();
    switchView("dashboard");
}

function switchView(viewName) {
    document.querySelectorAll(".view").forEach(v => {
        v.hidden = true;
        v.classList.remove("active-view");
    });
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.hidden = false;
        target.classList.add("active-view");
    }

    document.querySelectorAll(".sidebar-item").forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-target") === viewName) {
            item.classList.add("active");
        }
    });

    // Carregar dados específicos da view
    if (viewName === "dashboard") loadDashboardData();
    if (viewName === "transacoes") loadTransactionsPage();
    if (viewName === "planejamento") loadPlanningData();
    if (viewName === "relatorios") loadReportsData();
    if (viewName === "configuracoes") loadConfigData();
}

/* --- API Requests & Módulos --- */
async function fetchCategories() {
    try {
        const res = await fetch(`${API_BASE}/categorias`);
        const data = await res.json();
        globalCategories = data;
    } catch (e) {
        console.error("Erro ao buscar categorias", e);
    }
}

async function loadUserProfile() {
    try {
        const res = await fetch(`${API_BASE}/transacoes/resumo?usuario=${encodeURIComponent(currentUser)}`);
        // Extrair nome do usuário logado através do login anterior ou metadados
        const nameParts = currentUser.split("_");
        const firstName = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
        
        document.getElementById("header-user-name").textContent = firstName;
        document.getElementById("greeting-text").textContent = `Olá, ${firstName}`;
    } catch (e) {
        console.error(e);
    }
}

async function loadDashboardData() {
    try {
        const res = await fetch(`${API_BASE}/transacoes/resumo?usuario=${encodeURIComponent(currentUser)}`);
        const summary = await res.json();
        
        const saldo = (summary.receitas || 0) - (summary.despesas || 0);
        document.getElementById("dash-saldo").textContent = formatMoney(saldo);
        document.getElementById("dash-receitas").textContent = formatMoney(summary.receitas);
        document.getElementById("dash-despesas").textContent = formatMoney(summary.despesas);

        // Balanço Mensal Barras
        const balancoContainer = document.getElementById("dash-balanco-bars");
        balancoContainer.innerHTML = `
            <div style="display:flex; justify-content:space-around; align-items:flex-end; height:120px; padding-top:20px;">
                <div style="text-align:center;"><div style="width:40px; height:${Math.min(100, (summary.receitas||1)/10)}px; background:var(--success); border-radius:4px;"></div><small>Rec</small></div>
                <div style="text-align:center;"><div style="width:40px; height:${Math.min(100, (summary.despesas||1)/10)}px; background:var(--danger); border-radius:4px;"></div><small>Esp</small></div>
            </div>
        `;

        // Planejamento Preview
        const metaRes = await fetch(`${API_BASE}/metas/listar?usuario=${encodeURIComponent(currentUser)}`);
        const metas = await metaRes.json();
        if (metas && metas.length > 0) {
            document.getElementById("dash-plan-msg").textContent = `Meta ativa: ${metas[0].titulo} (${metas[0].porcentagem_meta}%)`;
        }
    } catch (e) { console.error(e); }
}

/* --- Transações Módulo --- */
async function loadTransactionsPage() {
    try {
        const res = await fetch(`${API_BASE}/transacoes/listar?usuario=${encodeURIComponent(currentUser)}`);
        allTransactions = await res.json() || [];
        
        // Calcular Resumo
        let rec = 0, desp = 0;
        allTransactions.forEach(t => {
            if (t.tipo === 'receita') rec += t.valor;
            else desp += t.valor;
        });
        document.getElementById("trans-saldo").textContent = formatMoney(rec - desp);
        document.getElementById("trans-receitas").textContent = formatMoney(rec);
        document.getElementById("trans-despesas").textContent = formatMoney(desp);

        renderTransactionsTable();
    } catch (e) { console.error(e); }
}

function renderTransactionsTable() {
    const tbody = document.querySelector("#table-transacoes tbody");
    tbody.innerHTML = "";

    const start = (currentPage - 1) * itemsPerPage;
    const paginatedItems = allTransactions.slice(start, start + itemsPerPage);

    paginatedItems.forEach(t => {
        const tr = document.createElement("tr");
        const isPast = new Date(t.data) <= new Date();
        const statusIcon = isPast ? '<span style="color:var(--success); font-weight:bold;">✔ Efetuada</span>' : '<span style="color:var(--danger); font-weight:bold;">❗ Pendente</span>';

        tr.innerHTML = `
            <td><input type="checkbox" class="trans-checkbox" data-id="${t.transacao_id}"></td>
            <td>${dateIsoToBr(t.data)}</td>
            <td>${t.tipo}</td>
            <td>${t.categoria}</td>
            <td class="${t.tipo === 'receita' ? 'text-green' : 'text-red'}">${formatMoney(t.valor)}</td>
            <td>${statusIcon}</td>
            <td>
                <button class="btn-text btn-edit-trans" data-id="${t.transacao_id}">✏️</button>
                <button class="btn-text btn-del-trans" data-id="${t.transacao_id}">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Listeners de seleção individual
    document.querySelectorAll(".trans-checkbox").forEach(cb => {
        cb.addEventListener("change", updateBulkDeleteButton);
    });

    // Listeners de editar/deletar unitário
    document.querySelectorAll(".btn-del-trans").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (!confirm("Excluir esta transação?")) return;
            await fetch(`${API_BASE}/transacoes/deletar`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario: currentUser, transacao_id: id })
            });
            loadTransactionsPage();
            loadDashboardData();
        });
    });

    renderPagination();
}

function updateBulkDeleteButton() {
    const count = document.querySelectorAll(".trans-checkbox:checked").length;
    document.getElementById("btn-delete-selected").disabled = count === 0;
}

function renderPagination() {
    const paginationContainer = document.getElementById("trans-pagination");
    paginationContainer.innerHTML = "";
    const totalPages = Math.ceil(allTransactions.length / itemsPerPage) || 1;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener("click", () => {
            currentPage = i;
            renderTransactionsTable();
        });
        paginationContainer.appendChild(btn);
    }
}

function openTransModal(trans = null) {
    document.getElementById("modal-transacao").hidden = false;
    const tipoSelect = document.getElementById("trans-tipo-select");
    
    if (trans) {
        document.getElementById("modal-trans-title").textContent = "Editar Transação";
        document.getElementById("trans-id-hidden").value = trans.transacao_id;
        tipoSelect.value = trans.tipo;
        populateCategorySelect(trans.tipo, trans.categoria);
        document.getElementById("trans-valor-input").value = trans.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        document.getElementById("trans-data-input").value = dateIsoToBr(trans.data);
        document.getElementById("trans-status-select").value = trans.status;
    } else {
        document.getElementById("modal-trans-title").textContent = "Nova Transação";
        document.getElementById("trans-id-hidden").value = "";
        tipoSelect.value = "receita";
        populateCategorySelect("receita");
        document.getElementById("form-transacao").reset();
        document.getElementById("trans-data-input").value = new Date().toLocaleDateString("pt-BR");
    }
}

function populateCategorySelect(tipo, selectedCat = null) {
    const catSelect = document.getElementById("trans-cat-select");
    catSelect.innerHTML = "";
    const cats = globalCategories[tipo] || [];
    cats.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        if (c === selectedCat) opt.selected = true;
        catSelect.appendChild(opt);
    });
}

/* --- Planejamento & Cofrinho Módulo --- */
async function loadPlanningData() {
    try {
        const res = await fetch(`${API_BASE}/metas/listar?usuario=${encodeURIComponent(currentUser)}`);
        const metas = await res.json();
        const grid = document.getElementById("piggy-grid");
        grid.innerHTML = "";

        if (metas && metas.length > 0) {
            const meta = metas[0];
            document.querySelector("#form-meta input[name='titulo']").value = meta.titulo;
            document.querySelector("#form-meta input[name='salario_liquido']").value = meta.salario_liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
            document.querySelector("#form-meta input[name='porcentagem_meta']").value = meta.porcentagem_meta;
            document.getElementById("btn-delete-meta").hidden = false;

            const totalMetaVal = (meta.salario_liquido * meta.porcentagem_meta) / 100;
            document.getElementById("piggy-total").textContent = formatMoney(totalMetaVal);

            // Renderizar 50 quadradinhos do cofrinho proporcionais
            const boxCount = 50;
            const boxValue = totalMetaVal / boxCount;
            let savedVal = 0;

            for (let i = 1; i <= boxCount; i++) {
                const box = document.createElement("div");
                box.className = "piggy-box";
                box.textContent = i;
                box.addEventListener("click", () => {
                    box.classList.toggle("checked");
                    const checkedCount = grid.querySelectorAll(".piggy-box.checked").length;
                    savedVal = checkedCount * boxValue;
                    document.getElementById("piggy-saved").textContent = formatMoney(savedVal);
                });
                grid.appendChild(box);
            }
        } else {
            document.getElementById("btn-delete-meta").hidden = true;
            grid.innerHTML = `<p class="text-muted">Opa! Você ainda não possui um planejamento definido para este mês.</p>`;
        }
    } catch (e) { console.error(e); }
}

/* --- Relatórios e Configurações --- */
function loadReportsData() {
    document.getElementById("report-chart-rec").innerHTML = `<p class="text-muted">Gráfico detalhado de Receitas por Categoria carregado.</p>`;
    document.getElementById("report-chart-esp").innerHTML = `<p class="text-muted">Gráfico detalhado de Despesas por Categoria carregado.</p>`;
    document.getElementById("report-history-chart").innerHTML = `<p class="text-muted">Histórico de balanço dos últimos 6 meses renderizado.</p>`;
}

async function loadConfigData() {
    document.getElementById("config-input-nome").value = currentUser.split("_")[0] || "";
    document.getElementById("config-input-sobrenome").value = "";
}

/* --- PWA Service Worker --- */
function initPWA() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .then(() => console.log("Service Worker registrado com sucesso."))
            .catch(err => console.error("Erro ao registrar SW:", err));
    }

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById("btn-pwa-install");
        if (installBtn) {
            installBtn.hidden = false;
            installBtn.addEventListener("click", () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === "accepted") {
                        console.log("Usuário aceitou a instalação do PWA");
                    }
                    deferredPrompt = null;
                });
            });
        }
    });
}
