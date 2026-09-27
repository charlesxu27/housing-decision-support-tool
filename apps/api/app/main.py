from __future__ import annotations

import copy
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .features import assemble_feature_card
from .llm import llm_narrative
from .schemas import RecommendRequest
from .scoring import score_types

ROOT = Path(__file__).resolve().parents[3]
_root_env = ROOT / ".env"
_api_env = Path(__file__).resolve().parents[1] / ".env"
if _root_env.exists():
    load_dotenv(_root_env, override=True)
if _api_env.exists():
    load_dotenv(_api_env, override=True)

app = FastAPI(title="PGH Housing Advisor", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "openai": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    }


@app.post("/recommend")
async def recommend(req: RecommendRequest) -> dict:
    card = await assemble_feature_card(req.lat, req.lon)
    if not card.get("ok"):
        raise HTTPException(status_code=404, detail=card.get("error"))
    ranked = score_types(card)
    narrative, engine = await llm_narrative(card, ranked)
    card_out = copy.deepcopy(card)
    geom = (card_out.get("parcel") or {}).pop("geometry", None)
    return {
        "card": card_out,
        "geometry": geom,
        "ranked": ranked,
        "narrative": narrative.model_dump(),
        "engine": engine,
    }
