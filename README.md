# Cumbuca Tools

Ferramentas online para gestão de fluxo de caixa, menu semanal, precificação e manutenção para o ecossistema Cumbuca.

## Visão geral

- `server.js` serve a aplicação Node.js no backend e roteia todas as requisições.
- `public/` contém assets estáticos, incluindo `app.js`, `styles.css`, `index.html`, `sw.js` e `manifest.json`.
- `test/` contém testes unitários e de layout.
- `.github/workflows/verify.yml` executa CI para validação em `push` e `pull_request`.

## Requisitos

- Node.js 18 ou superior
- npm

## Instalação

```bash
npm ci
```

## Scripts úteis

- `npm start`: inicia o servidor local em `server.js`
- `npm run dev`: mesma coisa que `npm start`
- `npm run check`: valida sintaxe de `server.js` e `public/app.js`
- `npm run lint`: executa ESLint sobre os arquivos JavaScript
- `npm run test`: executa os testes Node.js em `test/`
- `npm run test:visual`: executa os testes Playwright
- `npm run verify`: roda `lint`, `check`, `test` e `test:visual`
- `npm run format`: formata arquivos com Prettier
- `npm run deploy`: roda `verify` e então faz deploy no Vercel usando `npx vercel --prod --yes`

## Desenvolvimento

1. Instale dependências:

```bash
npm ci
```

2. Use `npm run lint` para checar consistência de código.
3. Use `npm run test` para validar a lógica do servidor.
4. Use `npm run test:visual` para verificar a interface e fluxos end-to-end.

## Deploy

O deploy oficial usa Vercel.

```bash
npm run deploy
```

Para usar credenciais privadas e remover os avisos de segurança, configure na Vercel:

- `CUMBUCA_PASSWORD`: senha privada de produção
- `CUMBUCA_AUTH_SECRET`: segredo longo e aleatório para assinar sessões

Enquanto essas variáveis não estiverem configuradas, o servidor registra um aviso de segurança sem interromper a aplicação.

### GitHub Actions

O repositório já possui pipeline CI configurada em `.github/workflows/verify.yml`.
Ela executa `npm run verify` em pushes e pull requests para `main`.

Para deploy automático via GitHub Actions, configure os segredos:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Estrutura do projeto

- `server.js`: servidor Node.js e rotas principais
- `public/`: frontend estático e service worker
- `test/`: testes automatizados
- `backups/`: scripts e exportações de backup
- `.github/workflows/`: pipeline de CI

## Observações

- O app utiliza `POSTGRES_URL`, `POSTGRES_PRISMA_URL` ou `DATABASE_URL` para conexão com o banco de dados.
- O service worker é registrado em `public/index.html` e serve a aplicação offline/cached.
