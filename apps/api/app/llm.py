from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from .schemas import RecommendationText


def _fmt_money(v: Any) -> str:
    try:
        return f"${int(float(v)):,}"
    except (TypeError, ValueError):
        return "n/a"


def _fmt_pct(v: Any) -> str:
    try:
        return f"{float(v) * 100:.0f}%"
    except (TypeError, ValueError):
        return "n/a"


def template_narrative(
    card: dict[str, Any], ranked: list[dict[str, Any]], audience: str
) -> RecommendationText:
    top = ranked[0] if ranked else None
    top2 = ranked[1] if len(ranked) > 1 else None
    zoning = card.get("zoning") or {}
    transit = card.get("transit") or {}
    acs = card.get("acs") or {}
    hazards = card.get("hazards") or {}
    flood = hazards.get("flood") or {}
    lot = (card.get("parcel") or {}).get("lot_sqft")
    address = card.get("address") or "This parcel"
    zcode = zoning.get("code") or "unknown"

    voice = {
        "city": "For city housing staff, the question is what Pittsburgh should encourage here — not just what pencils for one owner.",
        "developer": "For an owner or builder, treat this as a screening memo: zoning, lot, hazards, and demand — not a pro forma.",
        "resident": "For neighbors, this is about what kinds of homes would fit the block and who they might serve.",
    }[audience]

    headline = (
        f"Lean toward {top['label'].lower()} here"
        if top
        else "Need more site detail"
    )
    summary = (
        f"{voice} {address} is in zoning district {zcode}"
        f"{' (' + zoning.get('name') + ')' if zoning.get('name') else ''}. "
        f"The strongest match is {top['label']} (score {top['score']})"
        + (f", with {top2['label']} close behind." if top2 else ".")
    )

    demand = (
        f"Census tract {acs.get('tract_name') or acs.get('geoid') or 'n/a'} has "
        f"median home value {_fmt_money(acs.get('median_value'))}, median rent "
        f"{_fmt_money(acs.get('median_rent'))}, vacancy {_fmt_pct(acs.get('vacancy_rate'))}, "
        f"and severe rent burden {_fmt_pct(acs.get('severe_rent_burden_share'))}. "
        "Those are neighborhood signals, not this building's asking price."
    )
    nearest = transit.get("nearest_m")
    transit_txt = (
        f"{transit.get('stops_400m')} mapped transit stops within 400m "
        f"({transit.get('stops_800m')} within 800m"
        + (f"; nearest about {nearest}m" if nearest is not None else "")
        + "). Higher-intensity housing is a better public investment where people can ride, walk, or bike."
        if transit.get("stops_400m") is not None
        else "Transit stop counts were unavailable for this click."
    )
    equity = (
        "Adding modest, multi-unit or accessory homes in high-burden tracts spreads opportunity without requiring every lot to become a tower. "
        "Do not treat ACS race or income fields as a reason to exclude people; use them to check whether new homes could ease cost pressure."
    )
    bits = []
    if flood.get("sfha"):
        bits.append(f"FEMA zone {flood.get('zone')} is a special flood hazard area — elevate, floodproof, or avoid new ground-floor units.")
    else:
        bits.append(f"FEMA flood zone {flood.get('zone') or 'unknown'} (not a substitute for a flood determination).")
    if hazards.get("steep_slope_25pct"):
        bits.append("The lot intersects Pittsburgh's 25%+ slope layer, so grading and retaining walls drive cost and review.")
    if hazards.get("undermined"):
        bits.append("Historic undermining is mapped here; treat as a geotechnical screen, not a safety sign-off.")
    climate = " ".join(bits)
    cost = (
        "Steep slopes, floodplain construction, mine due diligence, and small lots that need assembly all raise cost per home. "
        "County assessed value is not market value — use it only as a rough scale."
    )
    size = (
        f"Lot area is about {int(lot):,} sq ft."
        if lot
        else "Lot area was not reported."
    ) + " Match the building type to that envelope: ADUs and duplexes on modest lots; mid-rise usually needs more land or a corridor site."

    return RecommendationText(
        headline=headline,
        summary=summary,
        demand=demand,
        transit=transit_txt,
        equity=equity,
        climate=climate,
        cost=cost,
        size=size,
        sources_note="Numbers come from the linked public datasets. Zoning eligibility is a simplified prefix table, not a permit.",
    )


async def llm_narrative(
    card: dict[str, Any], ranked: list[dict[str, Any]], audience: str
) -> tuple[RecommendationText, str]:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return template_narrative(card, ranked, audience), "template"

    from openai import OpenAI

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    slim = {
        "address": card.get("address"),
        "in_city": card.get("in_city"),
        "parcel": {k: v for k, v in (card.get("parcel") or {}).items() if k != "geometry"},
        "assessment": card.get("assessment"),
        "zoning": card.get("zoning"),
        "hazards": card.get("hazards"),
        "transit": card.get("transit"),
        "acs": card.get("acs"),
        "flags": card.get("flags"),
        "ranked": ranked[:8],
        "audience": audience,
    }
    audience_instruction = {
        "city": "Write as a briefing for City of Pittsburgh housing staff: what the city should encourage or allow, with equity and climate in mind.",
        "developer": "Write as a screening memo for a developer or owner: feasibility, risk, and review burden. Not a bid.",
        "resident": "Write in plain language for a neighbor: what might get built and how it could affect the block.",
    }[audience]

    def _call():
        client = OpenAI(api_key=key)
        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "headline": {"type": "string"},
                "summary": {"type": "string"},
                "demand": {"type": "string"},
                "transit": {"type": "string"},
                "equity": {"type": "string"},
                "climate": {"type": "string"},
                "cost": {"type": "string"},
                "size": {"type": "string"},
                "sources_note": {"type": "string"},
            },
            "required": [
                "headline",
                "summary",
                "demand",
                "transit",
                "equity",
                "climate",
                "cost",
                "size",
                "sources_note",
            ],
        }
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You recommend housing types for a Pittsburgh parcel. "
                        "Use ONLY the JSON facts provided. Do not invent zoning rules, unit counts, or dollar figures. "
                        "If a field is null, say it is unknown. Cite dataset names (assessments, zoning GIS, FEMA, ACS, OSM). "
                        "Keep each section to 2–4 sentences. headline <= 90 characters. "
                        "Return a filled recommendation object (string values), never a JSON Schema. "
                        + audience_instruction
                    ),
                },
                {"role": "user", "content": json.dumps(slim)},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "recommendation_text",
                    "strict": True,
                    "schema": schema,
                },
            },
            temperature=0.4,
        )
        content = completion.choices[0].message.content or "{}"
        payload = json.loads(content)
        if "properties" in payload and "headline" not in payload:
            raise ValueError("model returned a schema instead of values")
        return RecommendationText.model_validate(payload)

    try:
        parsed = await asyncio.to_thread(_call)
    except Exception as exc:
        print(f"OpenAI narrative failed ({type(exc).__name__}: {exc}); using template.")
        return template_narrative(card, ranked, audience), "template"
    return parsed, "openai"
