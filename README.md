# Nexus — Gestão Financeira

Nexus é um PWA (Progressive Web App) de gestão financeira pessoal. Permite controlar receitas e despesas, planejar metas de economia e acompanhar relatórios financeiros, tudo em uma interface responsiva com suporte a tema claro/escuro e instalação como aplicativo.

## ✨ Funcionalidades

- **Autenticação** — login, criação de conta e recuperação de senha.
- **Dashboard** — resumo de receitas, despesas e saldo do mês, com gráficos (Chart.js) e prévia das metas de planejamento.
- **Transações** — criação, edição e exclusão de receitas/despesas, com categorias e status (pago/pendente) calculado automaticamente pela data.
- **Planejamento (Metas)** — o usuário define um valor total e o prazo em anos; o app divide automaticamente esse valor em parcelas mensais e exibe um "cofrinho" de quadradinhos que podem ser marcados conforme o dinheiro é guardado (uma vez marcado, não pode ser desmarcado). É possível ter **várias metas simultâneas**, cada uma com seu próprio prazo e progresso.
- **Relatórios** — balanço mensal e distribuição de receitas/despesas por categoria.
- **Configurações** — edição de nome/sobrenome, senha e foto de perfil, reinício dos dados e exclusão de conta.
- **Tema claro/escuro** com persistência local.
- **PWA instalável** — manifest, ícones e service worker, com botão de instalação e instruções para iOS/Android.

## 🗂️ Estrutura do projeto

```
├── index.html         # Estrutura da SPA (header, sidebar, área de conteúdo)
├── style.css          # Estilos, temas e responsividade
├── script.js          # Lógica do front-end (SPA com hash routing, chamadas à API, renderização das telas)
└── metas.py            # Rotas FastAPI do módulo de Metas (/metas/*)
```

> Este repositório contém os arquivos do front-end e o módulo de **Metas** do back-end. O back-end completo é uma API FastAPI modular (por exemplo, autenticação, transações e categorias ficam em outros arquivos do mesmo padrão de `metas.py`) que se conecta ao mesmo banco SQLite (`banco.db`) através de `bancodados.py`.

## 🛠️ Tecnologias

**Front-end**
- HTML, CSS e JavaScript puro (sem frameworks) — SPA com roteamento via hash (`#/dashboard`, `#/transacoes`, etc.)
- [Chart.js](https://www.chartjs.org/) para os gráficos
- Google Fonts (Inter)
- PWA: `manifest.json` + Service Worker

**Back-end**
- [FastAPI](https://fastapi.tiangolo.com/) — API REST
- [Pydantic](https://docs.pydantic.dev/) — validação dos dados de entrada
- [SQLite3](https://docs.python.org/3/library/sqlite3.html) — banco de dados local (`banco.db`)

## 🧮 Banco de dados

Três tabelas principais (definidas em `bancodados.py`):

| Tabela | Descrição |
|---|---|
| `usuarios` | Dados de login e perfil (nome, sobrenome, usuário, senha, foto) |
| `transacoes` | Receitas e despesas por usuário (tipo, categoria, valor, data, status) |
| `metas` | Metas de planejamento por usuário (título, valor total da meta, prazo em anos, parcelas concluídas) |

A tabela `metas` guarda:
- `meta` — valor total que o usuário quer alcançar;
- `anos` — prazo definido pelo usuário (o total de parcelas mensais é `anos × 12`);
- `parcelas_concluidas` — índices das parcelas já marcadas como guardadas, separados por vírgula.

O `criar_banco()` cuida das migrações simples via `ALTER TABLE` para bancos já existentes (ex: adicionar a coluna `anos` sem perder dados antigos).

## 🔌 Endpoints de Metas (`metas.py`)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/metas/criar` | Cria uma nova meta (`usuario`, `titulo`, `meta_total`, `anos`) |
| `PUT` | `/metas/atualizar` | Atualiza título, valor total e/ou prazo de uma meta existente |
| `GET` | `/metas/listar?usuario=` | Lista todas as metas do usuário, já com `total_parcelas` e `valor_parcela` calculados |
| `PUT` | `/metas/parcela` | Marca uma parcela (`indice`) como guardada |
| `DELETE` | `/metas/deletar?usuario=&titulo=` | Exclui uma meta |

## 🚀 Rodando localmente

### Back-end
```bash
pip install fastapi uvicorn
uvicorn app:app --reload
```
> Ajuste `app:app` para o nome do arquivo principal que registra o `router` de `metas.py` (e os demais routers) via `FastAPI()` + `app.include_router(...)`.

### Front-end
1. Ajuste a constante `API_BASE` em `script.js` para apontar para a URL da sua API (por padrão aponta para uma instância hospedada no Render).
2. Sirva os arquivos estáticos (`index.html`, `style.css`, `script.js`) com qualquer servidor HTTP, por exemplo:
```bash
python -m http.server 8080
```
3. Acesse `http://localhost:8080` no navegador.

## 📱 Instalação como PWA

O app pode ser instalado na tela inicial:
- **Android/Desktop:** clique em "Baixar App" no cabeçalho.
- **iOS:** use o botão de compartilhar do Safari → "Adicionar à Tela de Início".

## 📄 Licença

Projeto pessoal — defina a licença de acordo com sua necessidade (ex: MIT).
