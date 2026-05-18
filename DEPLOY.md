# Deploy oficial

O destino oficial da Cumbuca passa a ser Vercel + Supabase Postgres.

O app usa `POSTGRES_URL`, `POSTGRES_PRISMA_URL` ou `DATABASE_URL` para salvar dados no Postgres. A integração Supabase/Vercel normalmente cria `POSTGRES_URL` automaticamente.

Para publicar atualizações:

```bash
npm run deploy
```

O Railway ficou como legado temporário durante a migração:

https://cumbuca-production.up.railway.app

Depois de validar o Vercel com `database: true`, o Railway pode ser desligado/removido.
