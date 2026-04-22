# Plataforma de Jogos Pedagógicos

Plataforma web para professores acessarem jogos pedagógicos organizados por categoria.

## Funcionalidades

- **Autenticação** – login/logout com sessão segura
- **Cadastro de professor** – fica pendente até aprovação do administrador
- **Painel do administrador** – aprovar/rejeitar professores, CRUD completo de jogos
- **Jogos por categoria** – Matemática e Leitura/Escrita, ordenados A→Z
- **Identidade visual** – paleta #EFFAFD / #4A8BDF / #A0006D

## Pré-requisitos

- Node.js 18+

## Instalação e uso

```bash
npm install
npm start
```

O servidor inicia em <http://localhost:3000>.

### Usuário administrador padrão

| Campo | Valor |
|-------|-------|
| E-mail | admin@plataforma.com |
| Senha | admin123 |

> ⚠️ Altere a senha padrão em produção.

## Estrutura do projeto

```
├── server.js              # Entrada da aplicação
├── database/db.js         # SQLite (better-sqlite3) + seed
├── middleware/auth.js     # Autenticação e autorização
├── routes/
│   ├── auth.js            # Login, cadastro, logout
│   ├── admin.js           # Painel do administrador
│   └── games.js           # Telas do professor
├── views/                 # Templates EJS
│   ├── partials/          # head, navbar, footer
│   ├── admin/             # painel, editar-jogo
│   └── professor/         # categorias, lista
└── public/
    ├── css/style.css      # Estilos
    └── uploads/           # Ícones enviados pelo admin
```

## Banco de dados

O SQLite é criado automaticamente em `database/plataforma.db` na primeira execução.

### Tabela `usuarios`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK autoincrement |
| nome | TEXT | Nome completo |
| email | TEXT | E-mail único |
| senha | TEXT | Hash bcrypt |
| escola | TEXT | Opcional |
| tipo | TEXT | `admin` / `professor` |
| status | TEXT | `pendente` / `aprovado` / `rejeitado` |

### Tabela `jogos`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK autoincrement |
| nome | TEXT | Nome do jogo |
| categoria | TEXT | `matematica` / `leitura` |
| conteudos | TEXT | Conteúdos trabalhados |
| ano | TEXT | Ano escolar |
| icone_url | TEXT | URL ou caminho do ícone |
| link_jogo | TEXT | URL do jogo externo |

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| PORT | 3000 | Porta do servidor |
| SESSION_SECRET | (string interna) | Segredo da sessão |
