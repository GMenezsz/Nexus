const API_URL = "https://app-financas-api-gsjo.onrender.com";

// Elementos da Tela de Login
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const nomeInput = document.getElementById("nome");
const sobrenomeInput = document.getElementById("sobrenome");
const loginError = document.getElementById("login-error");

// Elementos da Tela Principal
const appScreen = document.getElementById("app-screen");
const userGreeting = document.getElementById("user-greeting");
const logoutBtn = document.getElementById("logout-btn");

// Elementos de Resumo
const saldoTotalEl = document.getElementById("saldo-total");
const totalReceitasEl = document.getElementById("total-receitas");
const totalDespesasEl = document.getElementById("total-despesas");

// Elementos de Transação
const transacaoForm = document.getElementById("transacao-form");
const tipoSelect = document.getElementById("tipo");
const categoriaSelect = document.getElementById("categoria");
const valorInput = document.getElementById("valor");
const transacaoError = document.getElementById("transacao-error");
const tabelaTransacoes = document.getElementById("tabela-transacoes");

let usuarioAtual = JSON.parse(localStorage.getItem("usuario_financas")) || null;
let categoriasDisponiveis = {};

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
    if (usuarioAtual) {
        mostrarApp();
    }
    carregarCategoriasDaApi();
});

// Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nome: nomeInput.value.trim(),
                sobrenome: sobrenomeInput.value.trim()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Erro ao fazer login.");
        }

        usuarioAtual = {
            id: data.usuario_id,
            nome: data.nome,
            sobrenome: data.sobrenome
        };

        localStorage.setItem("usuario_financas", JSON.stringify(usuarioAtual));
        mostrarApp();
    } catch (err) {
        loginError.textContent = err.message;
    }
});

// Logout
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario_financas");
    usuarioAtual = null;
    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginForm.reset();
});

function mostrarApp() {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    userGreeting.textContent = `${usuarioAtual.nome} ${usuarioAtual.sobrenome}`;
    carregarDadosDashboard();
}

// Buscar Categorias da API
async function carregarCategoriasDaApi() {
    try {
        const response = await fetch(`${API_URL}/categorias`);
        const data = await response.json();
        categoriasDisponiveis = data;
    } catch (err) {
        console.error("Erro ao carregar categorias:", err);
    }
}

// Atualizar select de categorias dependendo do tipo selecionado
tipoSelect.addEventListener("change", (e) => {
    const tipo = e.target.value;
    categoriaSelect.innerHTML = '<option value="">Selecione a categoria</option>';

    if (tipo && categoriasDisponiveis[tipo]) {
        categoriasDisponiveis[tipo].forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat;
            categoriaSelect.appendChild(option);
        });
    }
});

// Adicionar Transação
transacaoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    transacaoError.textContent = "";

    try {
        const response = await fetch(`${API_URL}/transacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario_id: usuarioAtual.id,
                tipo: tipoSelect.value,
                categoria: categoriaSelect.value,
                valor: parseFloat(valorInput.value)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Erro ao criar transação.");
        }

        transacaoForm.reset();
        categoriaSelect.innerHTML = '<option value="">Primeiro selecione o tipo</option>';
        carregarDadosDashboard();
    } catch (err) {
        transacaoError.textContent = err.message;
    }
});

// Carregar Resumo e Transações
async function carregarDadosDashboard() {
    await buscarResumo();
    await buscarTransacoes();
}

async function buscarResumo() {
    try {
        const response = await fetch(`${API_URL}/transacoes/${usuarioAtual.id}/resumo`);
        const data = await response.json();

        saldoTotalEl.textContent = formatarMoeda(data.saldo);
        totalReceitasEl.textContent = formatarMoeda(data.total_receitas);
        totalDespesasEl.textContent = formatarMoeda(data.total_despesas);
    } catch (err) {
        console.error("Erro ao buscar resumo:", err);
    }
}

async function buscarTransacoes() {
    try {
        const response = await fetch(`${API_URL}/transacoes/${usuarioAtual.id}`);
        const data = await response.json();

        tabelaTransacoes.innerHTML = "";

        if (data.transacoes.length === 0) {
            tabelaTransacoes.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #777;">Nenhuma transação encontrada.</td></tr>`;
            return;
        }

        data.transacoes.forEach(t => {
            const tr = document.createElement("tr");
            
            const isReceita = ["receita", "entrada", "ganhos"].includes(t.tipo.toLowerCase());
            const classeValor = isReceita ? "green" : "red";

            tr.innerHTML = `
                <td style="text-transform: capitalize;">${t.tipo}</td>
                <td>${t.categoria}</td>
                <td class="${classeValor}">${formatarMoeda(t.valor)}</td>
                <td><button class="btn-delete" onclick="deletarTransacao(${t.id})">Excluir</button></td>
            `;
            tabelaTransacoes.appendChild(tr);
        });
    } catch (err) {
        console.error("Erro ao buscar transações:", err);
    }
}

// Deletar Transação
async function deletarTransacao(id) {
    try {
        const response = await fetch(`${API_URL}/transacoes/${id}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Erro ao deletar transação.");
        }

        carregarDadosDashboard();
    } catch (err) {
        console.error(err);
        alert("Não foi possível excluir a transação.");
    }
}

// Utilitário para formatação de moeda BRL
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
