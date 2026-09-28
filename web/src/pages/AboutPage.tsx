import { Link } from 'react-router-dom'
import { PublishedSources } from '../panels/PublishedSources'
import { MethodStory } from '../story'

export function AboutPage() {
  return (
    <main className="content-page">
      <header className="page-hero">
        <p className="page-kicker">About the prototype</p>
        <h1>Evidence first. Tradeoffs in the open.</h1>
        <p>
          Allegheny Housing Match is an early decision-support tool for
          discussing which housing types may respond to local need, fit the
          physical context, and follow the current approval path.
        </p>
      </header>

      <section className="page-section">
        <MethodStory />
      </section>

      <section className="page-section prose-grid">
        <article>
          <p className="page-kicker">How rankings work</p>
          <h2>Values order choices; they do not rewrite facts.</h2>
          <p>
            Household patterns, housing stock, modeled site fit, hazards, and
            zoning status form the factual side of the model. Priority controls
            change the relative order of scenarios built from the selected
            tract. They cannot make a prohibited use permitted or erase a risk.
          </p>
          <p>
            That separation is intentional: disagreement about priorities
            should remain visible without becoming disagreement about what the
            source data says.
          </p>
        </article>
        <article className="scope-card">
          <p className="page-kicker">Current data scope</p>
          <h2>A screening tool—not a local finding.</h2>
          <p>
            The map reads a versioned snapshot of public data: ACS 5-year
            household and housing-stock estimates by Census tract, Allegheny
            County parcels and assessments, Pittsburgh zoning districts with a
            code matrix that stays marked draft until a person reviews it, FEMA
            flood hazard layers, PRT transit schedules, and City slope and
            undermined-area layers. Need and Fit cover the county; Allowed is
            computed only inside Pittsburgh and shown as unknown elsewhere.
            Values a source did not publish are shown as not available, never
            filled in. The map shows the build date and source vintages.
          </p>
        </article>
      </section>

      <section className="page-section" aria-labelledby="sources-heading">
        <header className="section-intro">
          <p className="page-kicker">Source catalog</p>
          <h2 id="sources-heading">Every number links back to a public dataset.</h2>
        </header>
        <PublishedSources heading="Sources in this snapshot" />
      </section>

      <section className="page-section limitations">
        <header className="section-intro">
          <p className="page-kicker">Use with care</p>
          <h2>What this tool cannot answer</h2>
        </header>
        <div className="limitations-grid">
          <article>
            <h3>It is not a legal determination.</h3>
            <p>
              Verify zoning text, overlays, permits, and approval requirements
              with the municipality.
            </p>
          </article>
          <article>
            <h3>It is not site due diligence.</h3>
            <p>
              Engineering, title, utilities, financing, environmental review,
              and constructability remain outside this prototype.
            </p>
          </article>
          <article>
            <h3>It is not community consent.</h3>
            <p>
              Modeled priorities cannot replace engagement with residents,
              especially people most affected by housing change.
            </p>
          </article>
          <article>
            <h3>It is not a final plan.</h3>
            <p>
              Use results to formulate questions and compare directions, never
              as an automated recommendation to act.
            </p>
          </article>
        </div>
      </section>

      <div className="page-section button-row">
        <Link className="button" to="/plan">
          Start a guided plan
        </Link>
        <Link className="button button-secondary" to="/map">
          Open the prototype map
        </Link>
      </div>
    </main>
  )
}
