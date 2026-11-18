/**
 * The `?state=` repro marker (T33).
 *
 * A panel that shows a state the shell forced from the URL carries
 * `data-fixture="<state>"` so a reviewer, a screenshot or an e2e assertion can
 * tell a repro apart from an answer the service actually gave. Kept out of
 * `states.tsx` so that file stays a pure component module (fast refresh).
 */
export const fixtureAttr = (fixture: string | undefined): { "data-fixture"?: string } =>
  fixture ? { "data-fixture": fixture } : {};
