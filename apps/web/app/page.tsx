"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BOOKMARKS, type Audience, type RecommendResponse } from "@/lib/types";

const MapCanvas = dynamic(() => import("./components/MapCanvas"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [audience, setAudience] = useState<Audience>("city");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendResponse | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number } | null>(null);
  const [lastClick, setLastClick] = useState<{ lat: number; lon: number } | null>(null);

  async function lookup(lat: number, lon: number, aud: Audience = audience) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon, audience: aud }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`
        );
      }
      setData((await res.json()) as RecommendResponse);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not look up that parcel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Pittsburgh housing typology</div>
        <h1>What should the city build on this lot?</h1>
        <p className="lede">
          Click a parcel. Public data on zoning, lot size, transit, flood, slopes, mines, and
          neighborhood housing conditions feed a ranked list of housing types.
        </p>

        <div className="row">
          {(["city", "developer", "resident"] as Audience[]).map((a) => (
            <button
              key={a}
              className={audience === a ? "tab active" : "tab"}
              onClick={() => {
                setAudience(a);
                if (lastClick) void lookup(lastClick.lat, lastClick.lon, a);
              }}
            >
              {a === "city" ? "City staff" : a === "developer" ? "Developer" : "Resident"}
            </button>
          ))}
        </div>

        <div className="row">
          {BOOKMARKS.map((b) => (
            <button
              key={b.id}
              className="chip"
              onClick={() => {
                setLastClick({ lat: b.lat, lon: b.lon });
                setFlyTo({ lat: b.lat, lon: b.lon });
                void lookup(b.lat, b.lon);
              }}
            >
              {b.label}
              <span className="hint">{b.hint}</span>
            </button>
          ))}
        </div>

        <div className="status">
          {loading ? "Gathering parcel, zoning, hazards, census, and transit…" : "\u00a0"}
        </div>
        {error ? <div className="error">{error}</div> : null}
        {data ? <Results data={data} /> : null}

        <p className="disclaimer">
          Screening tool for a housing hackathon — not a permit, appraisal, flood determination, or
          legal interpretation of Title 9. Assessed value is not market value. Overlay districts and
          variances can change what is allowed.
        </p>
      </aside>
      <MapCanvas
        flyTo={flyTo}
        geometry={data?.geometry ?? null}
        onPick={(lat, lon) => {
          setLastClick({ lat, lon });
          void lookup(lat, lon);
        }}
      />
    </div>
  );
}

function Results({ data }: { data: RecommendResponse }) {
  const c = data.card;
  const n = data.narrative;
  const lot = c.parcel.lot_sqft;
  return (
    <div>
      <div className="meta">
        <strong>{c.address || `Parcel ${c.parcel.pin}`}</strong>
        <br />
        PIN {c.parcel.pin}
        {c.parcel.mapblocklo ? ` · ${c.parcel.mapblocklo}` : ""}
        {c.zoning?.code ? ` · ${c.zoning.code}` : ""}
        {c.zoning?.name ? ` (${c.zoning.name})` : ""}
        {lot ? ` · ${Math.round(lot).toLocaleString()} sq ft` : ""}
        {!c.in_city ? " · Outside City of Pittsburgh" : ""}
      </div>
      <h2 className="headline">{n.headline}</h2>
      <p className="body">{n.summary}</p>
      <p className="engine">
        Explanation:{" "}
        {data.engine === "openai"
          ? "OpenAI, grounded in the feature card"
          : "template (add OPENAI_API_KEY for a model writeup)"}
      </p>

      {data.ranked.map((t) => (
        <div className="type" key={t.id}>
          <h3>{t.label}</h3>
          <div className="score">{t.score}</div>
          <div className="bar">
            <span style={{ width: `${t.score}%` }} />
          </div>
          <div className="why">
            <span className="tag">{t.eligibility}</span>
            {t.why}
          </div>
        </div>
      ))}

      {(
        [
          ["Demand", n.demand],
          ["Transit", n.transit],
          ["Equity", n.equity],
          ["Climate & hazards", n.climate],
          ["Cost", n.cost],
          ["Size", n.size],
        ] as const
      ).map(([title, text]) => (
        <details key={title} open={title === "Demand" || title === "Climate & hazards"}>
          <summary>{title}</summary>
          <p>{text}</p>
        </details>
      ))}

      <div className="sources">
        {n.sources_note}
        <ul>
          {c.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
