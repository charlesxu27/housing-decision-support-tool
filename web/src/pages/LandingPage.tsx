import { Link } from 'react-router-dom'
import { PublishedSources } from '../panels/PublishedSources'
import { MethodStory } from '../story'

export function LandingPage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="page-kicker">Housing choices, made discussable</p>
          <h1>See where housing need, physical fit, and today’s rules align.</h1>
          <p className="hero-lede">
            Allegheny Housing Match helps municipal teams and community partners
            ask better early-stage questions before a site, policy, or program
            becomes a proposal.
          </p>
          <div className="button-row">
            <Link className="button" to="/plan">
              Start a guided plan
            </Link>
            <Link className="button button-secondary" to="/map">
              Explore the map
            </Link>
          </div>
          <p className="prototype-note">
            Prototype preview: results are screening signals built from public
            Allegheny County and Pittsburgh data, not findings about any
            parcel or a zoning determination.
          </p>
        </div>
        <div className="hero-visual" aria-label="Need, fit, and allowed preview">
          <div className="hero-orbit hero-orbit-need">
            <span>Need</span>
            <small>What is missing?</small>
          </div>
          <div className="hero-orbit hero-orbit-fit">
            <span>Fit</span>
            <small>Where could it work?</small>
          </div>
          <div className="hero-orbit hero-orbit-allowed">
            <span>Allowed</span>
            <small>What do rules permit?</small>
          </div>
          <strong>Better planning conversation</strong>
        </div>
      </section>

      <section className="page-section tutorial-section">
        <header className="section-intro">
          <p className="page-kicker">A short path from question to map</p>
          <h2>Start with context, then inspect the evidence.</h2>
        </header>
        <ol className="tutorial-grid">
          <li>
            <span>1</span>
            <h3>Describe the decision</h3>
            <p>Choose a goal, a municipality or neighborhood, and a housing type.</p>
          </li>
          <li>
            <span>2</span>
            <h3>Name your priorities</h3>
            <p>
              Make tradeoffs visible without changing household, site, hazard,
              or zoning facts.
            </p>
          </li>
          <li>
            <span>3</span>
            <h3>Read the configured map</h3>
            <p>
              Compare need, fit, and allowance; then open details and scenario
              tools when you need them.
            </p>
          </li>
        </ol>
      </section>

      <section className="page-section audience-section">
        <header className="section-intro">
          <p className="page-kicker">Built for a shared table</p>
          <h2>Different roles, one transparent starting point.</h2>
        </header>
        <div className="audience-grid">
          <article>
            <p className="card-icon" aria-hidden="true">
              ◫
            </p>
            <h3>Municipal staff</h3>
            <p>
              Screen places and housing types, surface approval barriers, and
              prepare questions for technical review.
            </p>
            <Link to="/plan">Configure a planning view →</Link>
          </article>
          <article>
            <p className="card-icon" aria-hidden="true">
              ◎
            </p>
            <h3>Community partners</h3>
            <p>
              See which assumptions are facts, which are modeled, and where
              community knowledge must shape the next step.
            </p>
            <Link to="/about">Read how decisions are framed →</Link>
          </article>
        </div>
      </section>

      <section className="page-section" aria-labelledby="landing-sources-heading">
        <header className="section-intro">
          <p className="page-kicker">Public data, named</p>
          <h2 id="landing-sources-heading">Insights on the map cite the dataset they come from.</h2>
        </header>
        <PublishedSources heading="Sources in this snapshot" />
        <p className="muted">
          <Link to="/about#sources-heading">How these sources are used</Link>
        </p>
      </section>

      <section className="page-section">
        <MethodStory title="Three questions before one recommendation" />
      </section>

      <section className="page-section tradeoffs-section">
        <header className="section-intro">
          <p className="page-kicker">No frictionless answer</p>
          <h2>Every promising direction carries benefits, harms, and unknowns.</h2>
        </header>
        <div className="tradeoff-grid">
          <article>
            <h3>Potential benefits</h3>
            <ul>
              <li>More homes that match household needs</li>
              <li>Reuse of existing buildings and infrastructure</li>
              <li>Clearer paths for policy or zoning conversations</li>
            </ul>
          </article>
          <article>
            <h3>Potential harms</h3>
            <ul>
              <li>Displacement pressure on current residents</li>
              <li>Environmental exposure or infrastructure strain</li>
              <li>False confidence from incomplete or outdated inputs</li>
            </ul>
          </article>
          <article>
            <h3>Known unknowns</h3>
            <ul>
              <li>Ownership, availability, and willingness to sell</li>
              <li>Water, sewer, engineering, and project feasibility</li>
              <li>Resident priorities that require direct engagement</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <p className="page-kicker">Ready to explore?</p>
          <h2>Turn your question into a focused map view.</h2>
        </div>
        <Link className="button button-light" to="/plan">
          Start planning
        </Link>
      </section>
    </main>
  )
}
