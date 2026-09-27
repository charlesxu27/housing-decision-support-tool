import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="content-page not-found">
      <p className="page-kicker">Page not found</p>
      <h1>That route is not part of this prototype.</h1>
      <Link className="button" to="/">
        Return home
      </Link>
    </main>
  )
}
