# Deploy oficial

O destino oficial da Cumbuca e Vercel + Supabase Postgres.

O app usa `POSTGRES_URL`, `POSTGRES_PRISMA_URL` ou `DATABASE_URL` para salvar dados no Postgres. A integracao Supabase/Vercel normalmente cria `POSTGRES_URL` automaticamente.

Para publicar atualizacoes:

```bash
npm run deploy
```
