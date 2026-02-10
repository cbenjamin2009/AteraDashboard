import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration
} from "@remix-run/react";

import stylesheet from "~/styles/app.css";

export const meta: MetaFunction = () => ([
  { title: "Atera Ops Dashboard" },
  {
    name: "description",
    content: "At-a-glance ticket KPIs pulled directly from the Atera API."
  }
]);

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="app-shell">
          <header className="site-header">
            <div className="site-header__brand">
              <span className="site-header__title">Rush IT Ops</span>
              <span className="site-header__subtitle">Atera Insights</span>
            </div>
            <nav className="site-nav">
              <NavLink
                to="/"
                prefetch="intent"
                className={({ isActive }) => (isActive ? "nav-link is-active" : "nav-link")}
              >
                Live Dashboard
              </NavLink>
              <NavLink
                to="/monthly-review"
                prefetch="intent"
                className={({ isActive }) => (isActive ? "nav-link is-active" : "nav-link")}
              >
                Monthly Review
              </NavLink>
            </nav>
          </header>

          <main className="app-main">
            <Outlet />
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
