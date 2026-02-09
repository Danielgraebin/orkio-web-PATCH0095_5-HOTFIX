# Orkio Web (PATCH 005a)

UI for Orkio with authentication, threads, file upload, streaming SSE, and RAG citations. Shows `request_id` for debugging and audit correlation.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API URL (e.g., `https://YOUR_BACKEND.up.railway.app`) |
| `PORT` | Server port (default: 3000) |

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t orkio-web .
docker run -p 3000:3000 -e VITE_API_BASE_URL=https://api.example.com orkio-web
```
