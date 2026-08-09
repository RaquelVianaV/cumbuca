# Deploy oficial

O destino oficial da Cumbuca e Vercel + Supabase Postgres.

O app usa `POSTGRES_URL`, `POSTGRES_PRISMA_URL` ou `DATABASE_URL` para salvar dados no Postgres. A integracao Supabase/Vercel normalmente cria `POSTGRES_URL` automaticamente.

O indicador de hospedagem mostra `Vercel: tudo normal` por padrão. Para exibir `Vercel: confira o plano` quando houver um alerta de uso, defina `CUMBUCA_VERCEL_USAGE_WARNING=true` na Vercel. Sem essa sinalização, o sistema não consulta nem expõe dados de cobrança da Vercel.

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
