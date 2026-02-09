# Deploy Orkio PATCH 005a no Railway

Este guia descreve o processo de deploy do Orkio PATCH 005a no Railway, utilizando dois serviços separados para backend (API) e frontend (Web).

## Pré-requisitos

Antes de iniciar o deploy, certifique-se de ter uma conta no Railway e uma chave de API da OpenAI configurada.

## Passo 1: Criar Projeto no Railway

Acesse o Railway Dashboard e crie um novo projeto. O projeto conterá três serviços: PostgreSQL, API e Web.

## Passo 2: Provisionar PostgreSQL

Adicione um serviço PostgreSQL ao projeto. O Railway fornecerá automaticamente a variável `DATABASE_URL`. Após a criação, execute o seguinte comando SQL para habilitar a extensão pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Passo 3: Deploy do Backend (orkio-api)

Crie um novo serviço a partir do repositório ou faça upload do ZIP. Configure as seguintes variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `PORT` | `8080` |
| `APP_ENV` | `production` |
| `DATABASE_URL` | (copiar do PostgreSQL) |
| `JWT_SECRET` | (gerar string aleatória de 64+ caracteres) |
| `OPENAI_API_KEY` | `sk-...` |
| `CORS_ORIGINS` | `https://SEU_FRONTEND.up.railway.app` |
| `ADMIN_API_KEY` | (gerar string aleatória) |

O Railway detectará automaticamente o Dockerfile e iniciará o build.

## Passo 4: Executar Migrations

Após o deploy do backend, execute as migrations do Alembic. No terminal do serviço:

```bash
alembic upgrade head
```

## Passo 5: Deploy do Frontend (orkio-web)

Crie outro serviço para o frontend. Configure as variáveis:

| Variável | Valor |
|----------|-------|
| `VITE_API_BASE_URL` | `https://SEU_BACKEND.up.railway.app` |
| `PORT` | `3000` |

## Passo 6: Configurar Domínios

No Railway, configure domínios públicos para ambos os serviços. Atualize a variável `CORS_ORIGINS` do backend com o domínio final do frontend.

## Passo 7: Verificar Deploy

Acesse o frontend e verifique se a conexão com a API está funcionando. O indicador de status deve mostrar "ok".

## Passo 8: Criar Primeiro Usuário

Registre um novo usuário através da interface. O primeiro usuário será criado na organização "public".

## Endpoints de Monitoramento

O backend expõe endpoints para monitoramento enterprise:

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/health` | Health check |
| `GET /api/metrics` | Métricas Prometheus |
| `GET /api/admin/stats` | Estatísticas (requer X-Admin-Key) |
| `GET /api/admin/audit` | Logs de auditoria (requer X-Admin-Key) |

## Troubleshooting

Se o backend não iniciar, verifique se `JWT_SECRET` está configurado corretamente. Em produção, o sistema recusa iniciar com valores placeholder.

Se o CORS falhar, verifique se `CORS_ORIGINS` contém exatamente a URL do frontend, incluindo protocolo (https://).

Para problemas com RAG, verifique se a extensão pgvector está habilitada no PostgreSQL.
