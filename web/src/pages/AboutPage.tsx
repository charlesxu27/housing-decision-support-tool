import { Link } from 'react-router-dom'
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
            change the relative order of illustrative scenarios. They cannot
            make a prohibited use permitted or erase a risk.
          </p>
          <p>
            That separation is intentional: disagreement about priorities
            should remain visible without becoming disagreement about what the
            source data says.
          </p>
        </article>
        <article className="scope-card">
          <p className="page-kicker">Current data scope</p>
          <h2>A workflow demo—not a local finding.</h2>
          <p>
            The map currently uses plausible fixture values around Homewood,
            Wilkinsburg, and nearby Pittsburgh neighborhoods. Geometry,
            demographic values, parcel capacity, zoning, hazards, transit, and
            scenario scores are illustrative unless the interface explicitly
            says otherwise.
          </p>
        </article>
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
