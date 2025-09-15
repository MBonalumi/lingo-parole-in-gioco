# Lingo Game API

FastAPI backend for Italian word guessing game.

## Quick Start

```bash
uv sync
uvicorn main:app --reload
```

API docs: http://localhost:8000/docs

## Endpoints

- `POST /reset` - Start new game
- `POST /guess` - Make a guess  
- `GET /status` - Game state