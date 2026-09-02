// ==================== CONFIG ====================
const API_URL = "https://app-financas-api-gsjo.onrender.com";
const CHAVE_USUARIO = "brotar_usuario";

// ==================== ESTADO ====================
let usuarioAtual = null;      // { usuario_id, nome, sobrenome }
let categoriasCache = null;   // { receita: [...], despesa: [...] }
let tipoSelecionado = "receita";
let idParaExcluir = null;

// ==================== ELEMENTOS ====================
const telaLogin = document.getElementById("tela-login");
const telaApp = document.getElementById("tela-app");
const formLogin = document.getElementById("form-login");
const inputNome = document.getElementById("input-nome");
const inputSobrenome = document.getElementById("input-sobrenome");
const erroLogin = document.getElementById("erro-login");
const btnEntrar = document.getElementById("btn-entrar");

const saudacao = document.getElementById("saudacao");
const btnSair = document.getElementById("btn-sair");
const btnAtualizar = document.getElementById("btn-atualizar");

const valorSaldo = document.getElementById("valor-saldo");
const valorReceitas = document.getElementById("valor-receitas");
const valorDespesas = document.getElementById("valor-despesas");
const listaCategorias = document.getElementById("lista-categorias");
const listaTransacoes = document.getElementById("lista-transacoes");

const btnNova = document.getElementById("btn-nova");
const fabNova = document.getElementById("fab-nova");
const modalFundo = document.getElementById("modal-fundo");
const btnFecharModal = document.getElementById("btn-fechar-modal");
const btnCancelarTransacao = document.getElementById("btn-cancelar-transacao");
const alternadorTipo = document.getElementById("alternador-tipo");
const formTransacao = document.getElementById("form-transacao");
const inputCategoria = document.getElementById("input-categoria");
const inputValor = document.getElementById("input-valor");
const erroTransacao = document.getElementById("erro-transacao");
const btnSalvarTransacao = document.getElementById("btn-salvar-transacao");

const modalConfirmarFundo = document.getElementById("modal-confirmar-fundo");
const btnCancelarExclusao = document.getElementById("btn-cancelar-exclusao");
const btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao");

const toast = document.getElementById("toast");

// ==================== HELPERS ====================
function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mostrarToast(mensagem, tipo = "ok") {
  toast.textContent = mensagem;
  toast.classList.toggle("erro", tipo === "erro");
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visivel"));
  clearTimeout(mostrarToast._timer);
  mostrarToast._timer = setTimeout(() => {
    toast.classList.remove("visivel");
    setTimeout(() => { toast.hidden = true; }, 250);
  }, 3200);
}

function alternarCarregando(botao, carregando) {
  const texto = botao.querySelector(".btn-texto");
  const spinner = botao.querySelector(".btn-spinner");
  botao.disabled = carregando;
  if (texto) texto.style.opacity = carregando ? "0" : "1";
  if (spinner) spinner.hidden = !carregando;
}

async function chamarApi(caminho, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      headers: { "Content-Type": "application/json" },
      ...opcoes,
    });
  } catch (erroRede) {
    throw new Error("Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.");
  }

  let corpo = null;
  try { corpo = await resposta.json(); } catch (_) { /* corpo vazio, ok */ }

  if (!resposta.ok) {
    const detalhe = corpo && corpo.detail ? corpo.detail : "Ocorreu um erro inesperado.";
    throw new Error(detalhe);
  }
  return corpo;
}

// ==================== SESSÃO ====================
function carregarSessao() {
  const salvo = localStorage.getItem(CHAVE_USUARIO);
  if (!salvo) return null;
  try { return JSON.parse(salvo); } catch (_) { return null; }
}

function salvarSessao(usuario) {
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

function encerrarSessao() {
  localStorage.removeItem(CHAVE_USUARIO);
  usuarioAtual = null;
  telaApp.hidden = true;
  telaLogin.hidden = false;
  formLogin.reset();
}

// ==================== LOGIN ====================
formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  erroLogin.hidden = true;

  const nome = inputNome.value.trim();
  const sobrenome = inputSobrenome.value.trim();

  if (nome.length < 3 || sobrenome.length < 3) {
    erroLogin.textContent = "Nome e sobrenome devem ter pelo menos 3 caracteres.";
    erroLogin.hidden = false;
    return;
  }

  alternarCarregando(btnEntrar, true);
  try {
    const dados = await chamarApi("/login", {
      method: "POST",
      body: JSON.stringify({ nome, sobrenome }),
    });
    usuarioAtual = dados;
    salvarSessao(dados);
    await entrarNoApp();
  } catch (erro) {
    erroLogin.textContent = erro.message;
    erroLogin.hidden = false;
  } finally {
    alternarCarregando(btnEntrar, false);
  }
});

btnSair.addEventListener("click", encerrarSessao);

// ==================== ENTRAR NO APP ====================
async function entrarNoApp() {
  telaLogin.hidden = true;
  telaApp.hidden = false;
  saudacao.textContent = `Olá, ${usuarioAtual.nome}`;
  await Promise.all([carregarResumo(), carregarTransacoes()]);
}

btnAtualizar.addEventListener("click", () => {
  carregarResumo();
  carregarTransacoes();
});

// ==================== RESUMO / SALDO ====================
async function carregarResumo() {
  try {
    const resumo = await chamarApi(`/transacoes/${usuarioAtual.usuario_id}/resumo`);
    valorSaldo.textContent = formatarMoeda(resumo.saldo);
    valorReceitas.textContent = formatarMoeda(resumo.total_receitas);
    valorDespesas.textContent = formatarMoeda(resumo.total_despesas);
    renderizarCategorias(resumo.resumo_categoria);
  } catch (erro) {
    mostrarToast(erro.message, "erro");
  }
}

function renderizarCategorias(resumoCategoria) {
  const entradas = Object.entries(resumoCategoria || {}).filter(([, v]) => v !== 0);

  if (entradas.length === 0) {
    listaCategorias.innerHTML = `<p class="estado-vazio">Ainda não há dados para agrupar por categoria.</p>`;
    return;
  }

  const maiorAbsoluto = Math.max(...entradas.map(([, v]) => Math.abs(v)), 1);

  listaCategorias.innerHTML = entradas
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([categoria, valor]) => {
      const positivo = valor >= 0;
      const largura = Math.max((Math.abs(valor) / maiorAbsoluto) * 100, 4);
      const cor = positivo ? "var(--income)" : "var(--expense)";
      return `
        <div class="categoria-item">
          <span class="categoria-nome">${escaparHtml(categoria)}</span>
          <span class="categoria-barra-fundo">
            <span class="categoria-barra" style="width:${largura}%; background:${cor};"></span>
          </span>
          <span class="categoria-valor" style="color:${cor}">${formatarMoeda(valor)}</span>
        </div>`;
    })
    .join("");
}

// ==================== TRANSAÇÕES ====================
async function carregarTransacoes() {
  try {
    const dados = await chamarApi(`/transacoes/${usuarioAtual.usuario_id}`);
    renderizarTransacoes(dados.transacoes || []);
  } catch (erro) {
    mostrarToast(erro.message, "erro");
  }
}

function ehReceita(tipo) {
  return ["receita", "entrada", "ganhos"].includes((tipo || "").toLowerCase());
}

function renderizarTransacoes(transacoes) {
  if (transacoes.length === 0) {
    listaTransacoes.innerHTML = `<p class="estado-vazio">Nenhuma transação ainda. Toque em "+ Nova transação" para começar.</p>`;
    return;
  }

  listaTransacoes.innerHTML = [...transacoes]
    .reverse()
    .map((t) => {
      const receita = ehReceita(t.tipo);
      const classe = receita ? "receita" : "despesa";
      const sinal = receita ? "+" : "−";
      const icone = receita ? "↑" : "↓";
      return `
        <div class="transacao-item ${classe}" data-id="${t.id}">
          <div class="transacao-icone">${icone}</div>
          <div class="transacao-info">
            <div class="transacao-categoria">${escaparHtml(t.categoria)}</div>
            <div class="transacao-tipo">${receita ? "Entrada" : "Saída"}</div>
          </div>
          <div class="transacao-valor">${sinal} ${formatarMoeda(t.valor)}</div>
          <button class="transacao-excluir" data-id="${t.id}" aria-label="Remover transação" title="Remover">🗑</button>
        </div>`;
    })
    .join("");
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

listaTransacoes.addEventListener("click", (evento) => {
  const botao = evento.target.closest(".transacao-excluir");
  if (!botao) return;
  idParaExcluir = botao.dataset.id;
  modalConfirmarFundo.hidden = false;
});

btnCancelarExclusao.addEventListener("click", () => {
  idParaExcluir = null;
  modalConfirmarFundo.hidden = true;
});

btnConfirmarExclusao.addEventListener("click", async () => {
  if (!idParaExcluir) return;
  try {
    await chamarApi(`/transacoes/${idParaExcluir}`, { method: "DELETE" });
    mostrarToast("Transação removida.");
    modalConfirmarFundo.hidden = true;
    idParaExcluir = null;
    await Promise.all([carregarResumo(), carregarTransacoes()]);
  } catch (erro) {
    mostrarToast(erro.message, "erro");
  }
});

// ==================== MODAL NOVA TRANSAÇÃO ====================
function abrirModalTransacao() {
  erroTransacao.hidden = true;
  formTransacao.reset();
  definirTipo("receita");
  modalFundo.hidden = false;
  carregarCategoriasSelect();
}

function fecharModalTransacao() {
  modalFundo.hidden = true;
}

btnNova.addEventListener("click", abrirModalTransacao);
fabNova.addEventListener("click", abrirModalTransacao);
btnFecharModal.addEventListener("click", fecharModalTransacao);
btnCancelarTransacao.addEventListener("click", fecharModalTransacao);
modalFundo.addEventListener("click", (e) => { if (e.target === modalFundo) fecharModalTransacao(); });
modalConfirmarFundo.addEventListener("click", (e) => {
  if (e.target === modalConfirmarFundo) { modalConfirmarFundo.hidden = true; idParaExcluir = null; }
});

alternadorTipo.addEventListener("click", (evento) => {
  const botao = evento.target.closest(".alternador-opcao");
  if (!botao) return;
  definirTipo(botao.dataset.tipo);
});

function definirTipo(tipo) {
  tipoSelecionado = tipo;
  [...alternadorTipo.children].forEach((b) => b.classList.toggle("ativo", b.dataset.tipo === tipo));
  preencherSelectCategorias();
}

async function carregarCategoriasSelect() {
  if (!categoriasCache) {
    try {
      categoriasCache = await chamarApi("/categorias");
    } catch (erro) {
      erroTransacao.textContent = erro.message;
      erroTransacao.hidden = false;
      return;
    }
  }
  preencherSelectCategorias();
}

function preencherSelectCategorias() {
  if (!categoriasCache) return;
  const lista = categoriasCache[tipoSelecionado] || [];
  inputCategoria.innerHTML = lista.map((c) => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join("");
}

formTransacao.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  erroTransacao.hidden = true;

  const valor = parseFloat(inputValor.value);
  if (isNaN(valor) || valor < 0) {
    erroTransacao.textContent = "Informe um valor válido, maior ou igual a zero.";
    erroTransacao.hidden = false;
    return;
  }

  alternarCarregando(btnSalvarTransacao, true);
  try {
    await chamarApi("/transacoes", {
      method: "POST",
      body: JSON.stringify({
        usuario_id: usuarioAtual.usuario_id,
        tipo: tipoSelecionado,
        categoria: inputCategoria.value,
        valor,
      }),
    });
    mostrarToast(tipoSelecionado === "receita" ? "Entrada adicionada." : "Saída adicionada.");
    fecharModalTransacao();
    await Promise.all([carregarResumo(), carregarTransacoes()]);
  } catch (erro) {
    erroTransacao.textContent = erro.message;
    erroTransacao.hidden = false;
  } finally {
    alternarCarregando(btnSalvarTransacao, false);
  }
});

// ==================== INICIALIZAÇÃO ====================
(function iniciar() {
  const sessao = carregarSessao();
  if (sessao && sessao.usuario_id) {
    usuarioAtual = sessao;
    entrarNoApp();
  }
})();
