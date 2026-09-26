# Barbearia Nobre — Sistema de Agendamento

Sistema completo e funcional de agendamento para barbearia, com backend real em **Node.js + Express** e banco de dados **SQLite** (usando o módulo nativo `node:sqlite`, sem dependências externas de banco). Frontend em HTML, CSS e JavaScript puro, consumindo a API via `fetch`.

## Funcionalidades

### Área do cliente
- Cadastro e login com senha protegida (hash + salt, `crypto.scrypt`)
- Página inicial, Serviços e Equipe como páginas/abas totalmente separadas, com dados reais vindos do banco, fotos (Pexels, uso livre) e textos descritivos de cada serviço/barbeiro
- Início com galeria do estúdio, depoimentos e horário/localização
- Serviços e Equipe com foto, descrição/especialidade e botão "Agendar" que já leva a intenção (serviço ou barbeiro escolhido) para o login/cadastro e pré-seleciona no fluxo de agendamento
- Agendamento guiado: serviço → barbeiro → data → horário, com fotos em cada etapa (horários disponíveis calculados em tempo real, sem conflitos)
- Cabeçalho da área do cliente com boas-vindas e card de "próximo agendamento" sempre visível
- Meus Agendamentos separados em "Próximos" e "Histórico"
- Perfil com estatísticas (total de agendamentos, concluídos, cancelados, barbeiro favorito, cliente desde) e edição de dados

### Área do barbeiro/admin
- Login próprio (`admin@barbearia.com` / `admin123` por padrão)
- Dashboard com estatísticas (agendamentos do dia, pendentes, faturamento do mês, total de clientes)
- **Agenda mostrando todos os próximos agendamentos por padrão, sem precisar escolher uma data** — agrupados por dia (Hoje, Amanhã, datas seguintes) para não ficar bagunçado, com contagem por dia. Também é possível alternar para ver **um dia específico**, filtrar por barbeiro e mostrar/ocultar cancelados
- Confirmar, concluir ou cancelar atendimentos
- Cadastrar, editar e remover serviços e preços
- Listagem de clientes com histórico de visitas

Tudo é persistido em um banco SQLite real (`data/barbearia.db`), criado automaticamente na primeira execução.

## Requisitos

- **Node.js 22.5 ou superior** (o projeto usa o módulo nativo `node:sqlite`, disponível a partir dessa versão — não é necessário instalar nenhum banco de dados separado)

## Como rodar localmente

```bash
git clone <url-do-seu-repositorio>
cd barbearia-nobre
npm install
npm start
```

O servidor sobe em `http://localhost:3000`. Abra esse endereço no navegador.

Na primeira execução o banco é criado automaticamente em `data/barbearia.db`, já populado com:
- 1 usuário administrador (`admin@barbearia.com` / `admin123`)
- 3 barbeiros
- 6 serviços com preços

> Dica: use `npm run dev` para reiniciar o servidor automaticamente a cada alteração de código.

## Estrutura do projeto

```
barbearia-nobre/
├── server/
│   ├── server.js      # servidor Express e todas as rotas da API REST
│   ├── db.js           # conexão SQLite, schema e dados iniciais (seed)
│   └── auth.js         # sessões, hash de senha e middlewares de autenticação
├── public/
│   ├── index.html       # aba Início
│   ├── servicos.html     # aba Serviços
│   ├── equipe.html       # aba Equipe
│   ├── login.html
│   ├── cadastro.html
│   ├── app.html          # área do cliente (agendar / meus agendamentos / perfil)
│   ├── admin.html        # painel do barbeiro/admin
│   ├── css/style.css
│   └── js/                # api.js, nav.js, content.js (fotos/textos), client.js, admin.js
├── data/                  # banco SQLite (gerado automaticamente, ignorado no git)
└── package.json
```

## API REST (resumo)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria conta de cliente |
| POST | `/api/auth/login` | Login (cliente ou admin) |
| POST | `/api/auth/logout` | Encerra a sessão atual |
| GET  | `/api/me` | Dados do usuário logado |
| PUT  | `/api/me` | Atualiza nome/telefone |
| GET  | `/api/services` | Lista serviços ativos |
| POST/PUT/DELETE | `/api/services/:id` | CRUD de serviços (somente admin) |
| GET  | `/api/barbers` | Lista barbeiros |
| GET  | `/api/availability?barberId&date&serviceId` | Horários livres |
| GET  | `/api/appointments` | Agendamentos (próprios ou todos, se admin) |
| POST | `/api/appointments` | Cria agendamento |
| PUT  | `/api/appointments/:id/status` | Confirma/conclui/cancela |
| GET  | `/api/clients` | Lista de clientes (somente admin) |
| GET  | `/api/stats` | Estatísticas do painel (somente admin) |

A autenticação usa token de sessão (Bearer token) armazenado no `localStorage` do navegador e validado no servidor a cada requisição — sessões expiram em 7 dias.

## Sobre as imagens

As fotos usadas no site (estúdio, galeria, serviços e barbeiros) vêm do [Pexels](https://www.pexels.com), banco de imagens gratuito que permite uso comercial sem atribuição. Elas são carregadas diretamente da CDN do Pexels (`images.pexels.com`), então é necessário estar conectado à internet para vê-las. Para trocar por fotos reais da barbearia/dos barbeiros, edite o arquivo `public/js/content.js`.

## Publicando no GitHub

```bash
git init
git add .
git commit -m "Sistema de agendamento Barbearia Nobre"
git branch -M main
git remote add origin <url-do-seu-repositorio>
git push -u origin main
```

O arquivo `.gitignore` já exclui `node_modules/` e o banco de dados local, então o repositório fica limpo. Quem clonar o projeto só precisa rodar `npm install && npm start`.

## Colocando em produção

Para hospedar de verdade (ex: Render, Railway, um VPS), basta rodar `npm install && npm start` em qualquer ambiente com Node.js 22.5+. O arquivo `data/barbearia.db` deve ficar em um disco persistente (não use plataformas com sistema de arquivos efêmero sem volume persistente, ou os dados serão perdidos a cada deploy).
