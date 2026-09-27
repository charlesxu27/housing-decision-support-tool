const REPOSITORY_URL =
  'https://github.com/charlesxu27/housing-decision-support-tool'

export function ContactPage() {
  return (
    <main className="content-page contact-page">
      <header className="page-hero">
        <p className="page-kicker">Contact</p>
        <h1>Questions about the project?</h1>
        <p>
          This page lists only contact information documented by the project.
          There is no form or automated submission service.
        </p>
      </header>

      <section className="contact-grid" aria-label="Project contact options">
        <article>
          <p className="card-icon" aria-hidden="true">
            @
          </p>
          <h2>Project contact</h2>
          <p>Stella S.</p>
          <a href="mailto:stellastricker@icloud.com">
            stellastricker@icloud.com
          </a>
        </article>
        <article>
          <p className="card-icon" aria-hidden="true">
            &lt;/&gt;
          </p>
          <h2>Source code</h2>
          <p>View the public repository, documentation, and issue history.</p>
          <a href={REPOSITORY_URL} rel="noreferrer" target="_blank">
            Open GitHub repository
          </a>
        </article>
      </section>

      <aside className="responsible-note">
        <strong>Planning or zoning question?</strong>
        <p>
          Contact the relevant municipality or a qualified professional. This
          prototype does not provide legal, permitting, engineering, or final
          planning advice.
        </p>
      </aside>
    </main>
  )
}
