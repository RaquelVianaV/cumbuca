# Deploy oficial

O destino oficial da Cumbuca e Vercel + Supabase Postgres.

O app usa `POSTGRES_URL`, `POSTGRES_PRISMA_URL` ou `DATABASE_URL` para salvar dados no Postgres. A integracao Supabase/Vercel normalmente cria `POSTGRES_URL` automaticamente.

Para publicar atualizacoes:

```bash
npm run deploy
```

## Verificação contínua

Esta base usa GitHub Actions para rodar `npm run verify` em pushes e PRs para `main`.

Para deploy automático pela pipeline GitHub Actions, configure os segredos:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
