# **Housing Typology Matchmaker: Team Plan**

**AI for Housing Hackathon · AI Horizons 2026 · Track 03: Housing Typology, Equity & Climate Matchmaker**  
*Living doc. Everyone please edit, comment, and add freely.*

## **1\. Team**

| Name | Role | Contact |
| :---- | :---- | :---- |
|  | \[e.g. scoring logic \+ LLM explanation \+ backend\] | \[email / Slack\] |
|  | \[e.g. data cleaning / UI / demo\] | \[email / Slack\] |
| Stella S | Explain why the tool matters to housing practitioners; review weights and assumptions.  | stellastricker@icloud.com |
|  | \[frontend\] UI and map |  |

## **2\. What we're building**

A user picks a Pittsburgh parcel, and the tool recommends which housing types fit it (single-family, duplex/triplex, small multifamily, ADU), with a plain-language explanation of the tradeoffs across **demand, transit, equity, and climate risk**.  
**Target user:** \[e.g. small developers, community development corporations (CDCs), city planners\] \*awaiting response from hackathon admin\*  
**Guiding principle:** simple tech, but it must run end-to-end reliably. A working demo beats a fancy idea.

## **3\. MVP scope**

> * Demo covers only 1–2 neighborhoods: \[neighborhood names\]  
> * Select a parcel → see ranked housing types with scores and reasons → LLM summary → risk flags  
> * At least one real Pittsburgh demo case (required by organizers)

**Nice to have (only if MVP is done):** compare two parcels, adjustable weights in the UI, zoning lookup

## **4\. Data**

| Indicator | Source | Owner | Status |
| :---- | :---- | :---- | :---- |
| Lot size, land use, parcel ID | Allegheny County Property Assessments (WPRDC) |  | Not started |
| Parcel geometry | Allegheny County parcel boundaries |  | Not started |
| Distance to transit | Pittsburgh Regional Transit stops |  | Not started |
| Floodplain / undermining | FEMA flood zones, undermining data (flood covers City of Pittsburgh only) |  | Not started |
| Median household income | U.S. Census ACS, by tract |  | Not started |

**Helpful open-source references** (allowed; must be listed in README):

> * prohousingpgh/agc\_assessments: where to download parcel, flood zone, and undermining data  
> * ianpcook/wprdc: query WPRDC datasets directly from Cursor  
> * WPRDC/property-api: parcel lookup API  
> * Organizer Data Resources spreadsheet (pinned in \#resources-and-data)

## **5\. How it works**

> 1. **Prepare data (offline):** join all sources into one table, one row per parcel (pandas / GeoPandas). Save locally so the demo never depends on live data APIs.  
> 2. **Score:** normalize each indicator to 0–1, then compute a weighted score per housing type. Weights live in a config file and are labeled as our assumptions, not zoning law.  
> 3. **Explain:** an LLM turns the computed scores into a short plain-language summary. It never invents numbers. If the API fails, fall back to a template explanation.  
> 4. **UI:** Streamlit page with parcel selector, map, ranked results, explanation, and flags.

## **6\. Timeline (build window ends Sun Sept 27, 11:59 p.m. ET, no late submissions)**

| Checkpoint | Goal |
| :---- | :---- |
| \[time\] | Clean data table ready for demo neighborhoods |
| \[time\] | Scoring works on demo parcels |
| \[time\] | UI \+ LLM explanation connected end-to-end |
| \[time\] | Record 3–5 min demo video |
| \[time, well before 11:59 p.m.\] | README finalized, form submitted |

Expert office hours in Slack: Sat & Sun 10 a.m.–6 p.m. ET (\#housing-sme-help, \#technical-help).

## **7\. Submission checklist**

> * ☐ Public GitHub repo (commit history starts after Sat 9 a.m. ET)  
> * ☐ 3–5 min demo video showing the tool actually running  
> * ☐ README: how to run, data sources, open-source code used, AI tools used, limitations  
> * ☐ Disclaimer: decision-support prototype, not legal/financial/zoning advice  
> * ☐ Submission Google Form (link in Slack \#schedule-and-announcements)

## **8\. Links**

> * GitHub repo: [https://github.com/charlesxu27/housing-decision-support-tool](https://github.com/charlesxu27/housing-decision-support-tool)  
> * Demo video: \[link\] Loom with all of the team 3-5 minute demo \+ tradeoffs \+ target rubric points  
> * Challenge brief: 

## **9\. Open questions / notes**

> * \[Add here\]

## **10\. Reference**

Hackathon CanvasFor hackathon admins:

* Who is our end user for Track 3? IT looks like "MUNICIPALITIES" \-- so government officials.  
* Are the judges actually part of Alleghany county? What is their motive \-- to provide affordable housing or to build new housing and make maximum profit?

* Do they want to build residential lots (developer centric) or building affordable neighborhoods?  
* Are they looking to build apartment housing or single-family houses?  
* Where can they build?  
  * analyze housing rules / historical policies /   
* We should have a caveat that housing problems will always have winners and losers \-- we need to explain what we optimized for and the trickle effects of our decisions.

***TOPIC***  
***3\. Housing Typology, Equity & Climate Matchmaker***  
***A decision-support tool matching locations with plausible housing types and surfacing tradeoffs across demand, transit, equity, and climate resilience.***  
***Helps municipalities decide what housing fits where, and community partners who want a say in that answer. The hard part is that the tradeoffs genuinely conflict — a tool that pretends there's one right***  
***answer is less useful than one showing you what you're giving up.***  
***These datasets describe real neighborhoods and real households. The strongest submissions are explicit about who benefits, who might be harmed, and what the tool gets wrong. "We don't have good data on X, so our tool doesn't claim to answer it" is a strength, and judges score it that way***

**SCORING**  
Judges come from housing practice, universities, technology, and the investment community. Some will know your track's subject matter deeply and some will be evaluating your technical work. This is why explaining your project clearly matters as much as building it well.  
\=============================  
**Evaluation Criteria**  
**Problem Value**  
Does the prototype address a costly, frequent, or consequential housing bottleneck identified in the challenge briefs (e.g., development feasibility, missing-middle housing typologies, or policy/permitting navigation)?  
**User Fit & Usability**  
Is the interface intuitive, plain-language, and practical for target end-users (such as municipal planners, small developers, nonprofits, or community partners) to adopt?  
---

**Technical Execution**  
Does the working demo/prototype reliably perform its core functional tasks during testing and presentation?  
**Data & AI Integrity**  
Are sources, statutes, and baseline assumptions accurately cited and grounded? Are privacy constraints (no PII/sensitive data) and model uncertainties handled responsibly? Is there a clear human-in-the-loop/escalation path for consequential decisions?  
---

**Actionability**  
Does the output directly assist or accelerate real-world decisions in housing development, policy, planning, or permitting rather than merely presenting abstract analytics?  
**Continuation Potential**  
Is there a credible path to post-event testing, maintenance, community ownership, or pilot adoption by public/civic partners (e.g., Allegheny County, City Planning, URA, PHFA)?  
---

**MANDATORY ELIGIBILITY & COMPLIANCE CHECKS:**  
• Originality: Must be a new, ground-up build created during the hackathon window (no pre-existing products/pitches).  
• Required Deliverables: Working code repository, demo video (3-5 min), documentation, data/source citations, and limitations statement.  
• Responsible Framing: Tool must be positioned strictly as decision support, not binding legal, financial, or zoning advice.

**Academic papers**

* Al-Shalabi, M., Mansor, S.B., Ahmed, N.B., & Shiriff, R. (2006). GIS based multicriteria approaches to housing site suitability assessment. *Geographic Information Sciences Research*, 13(2), 16–25. A classic paper combining GIS with AHP (Analytical Hierarchy Process) to evaluate candidate housing sites and support location decisions. [https://www.fig.net/resources/Proceedings//fig\_proceedings/fig2006/papers/ts72/ts72\_05\_alshalabi\_etal%20\_0702.pdf](https://www.fig.net/resources/Proceedings//fig_proceedings/fig2006/papers/ts72/ts72_05_alshalabi_etal%20_0702.pdf)




