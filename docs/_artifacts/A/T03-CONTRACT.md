# T03 — Shell Fixture Mechanism: App-Wiring Integration Contract

Implementation: `web/src/shell/fixtures.ts` (pure + React primitives, no JSX,
zero imports from App/pages). Tests: `web/src/shell/fixtures.test.ts`.

Any pane gets the four PRD states (加载中/空态/错误/就绪) from the URL alone.
Wiring cost: **three lines, once**, in the console layout. Panes opt in per
view with **one wrapper call** — or zero, since the `data-fixture` root
attribute already lets CSS/e2e key off the state.

## URL forms (both parsed by `parseFixtureState(search, hash)`)

| Form | Example | Case |
|---|---|---|
| window.search | `/web/?state=empty#/duty` | full-URL entry / hard refresh — a **global** fixture switch, survives SPA nav |
| in-hash query | `#/duty?state=loading` | SPA-nav form — **per-view**, and it **wins** over window.search when both are present |

Invalid `?state=xyz` → treated as absent (`null` → consumers render `ready`)
with one `console.warn` per distinct bad value (dedup set in the module;
`resetFixtureWarnOnce()` exists for tests).

## Wiring (the lane that owns App.tsx)

```tsx
import { FixtureProvider, FixtureBadge, applyFixtureAttribute, useFixtureState } from './shell/fixtures';

// 1. wrap the console layout root (inside BrowserRouter, above <Routes>):
<FixtureProvider> …existing layout… <FixtureBadge /> </FixtureProvider>

// 2. mirror the override on <html> — one effect inside a layout child:
const { override } = useFixtureState();               // { state, override }
useEffect(() => applyFixtureAttribute(document.documentElement, override), [override]);
//    (or call the ready-made useFixtureMirror(document.documentElement) hook)

// 3. a pane swapping its four views — ONE wrapper, lazy branches:
const { state } = useFixtureState();                  // state never null (override ?? 'ready')
return fixtureView(state, {
  loading: () => <Spinner />, empty: () => <Empty />, error: () => <ErrorState />, ready: () => <Real />,
});
```

## Contract rules

- `FixtureProvider` supplies `FixtureState | null`; **null means "no fixture"** and every consumer default (`resolveFixtureState`, `useFixtureState().state`, `useFixtureStateValue()`) resolves it to `ready`.
- `applyFixtureAttribute(el, null)` **removes** `data-fixture` — attribute-free means ready; pass a state explicitly (`resolveFixtureState(override)`) if CSS needs `[data-fixture="ready"]`. Precedent for root data-* attributes: `document.documentElement.dataset.layoutVariant` (`web/src/themes/context.tsx`).
- `<FixtureBadge/>` renders only while an override is active, fixed bottom-right, carries `data-testid="shell-fixture-badge"` + `data-fixture`; inline styles reference tokens.css vars (`--panel-2/--fg/--line-2/--r-sm/--mono/--info/--fg-3/--bad/--ok`) with literal fallbacks — tokens.css itself is untouched.
- Live sync listens on `popstate` + `hashchange`; react-router `pushState` navigation fires neither, so the provider value updates on back/forward, manual hash edits and hash-based SPA nav. Panes that remount per route read fresh values anyway (the initial state read is live), and `currentFixtureState()` is always live if the wiring lane wants to feed it from a router location hook.
- `parseHash` in `web/src/shell/routes.ts` keeps unknown query keys in `ParsedLocation.params`, so `state` never conflicts with tab/view/zone resolution; fixtures.ts parses the raw strings itself and imports nothing from routes.ts.
