from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Audience = Literal["city", "developer", "resident"]


class RecommendRequest(BaseModel):
    lat: float = Field(..., ge=39.5, le=42.5)
    lon: float = Field(..., ge=-81.5, le=-78.5)
    audience: Audience = "city"


class RankedType(BaseModel):
    id: str
    label: str
    blurb: str
    score: int
    eligibility: str
    why: str
    flags: list[str] = []


class RecommendationText(BaseModel):
    headline: str
    summary: str
    demand: str
    transit: str
    equity: str
    climate: str
    cost: str
    size: str
    sources_note: str = ""
