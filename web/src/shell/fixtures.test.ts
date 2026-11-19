// @vitest-environment jsdom
/**
 * T03 fixture mechanism — colocated tests (shell-alignment lane).
 * Pure parsing + resolve + view selection first, then the React badge /
 * provider against jsdom (vitest.config.ts default env is 'node'; the
 * per-file docblock above opts in, same as src/modules/duty/dutyPage.test.tsx).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FixtureBadge,
  FixtureProvider,
  applyFixtureAttribute,
  currentFixtureState,
  fixtureView,
  parseFixtureRid,
  parseFixtureState,
  resetFixtureWarnOnce,
  resolveFixtureState,
  useFixtureStateValue,
  type FixtureState,
} from './fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ------------------------------ pure: parse ----------------------------- */

describe('parseFixtureRid', () => {
  it('reads the window.search form and the in-hash form', () => {
    expect(parseFixtureRid('?rid=abc12345', '')).toBe('abc12345');
    expect(parseFixtureRid('', '#/employees?state=error&rid=abc12345')).toBe('abc12345');
  });

  it('hash-internal query takes precedence over window.search', () => {
    expect(parseFixtureRid('?rid=outer', '#/duty?rid=inner')).toBe('inner');
  });

  it('missing/empty → null', () => {
    expect(parseFixtureRid('', '#/duty')).toBeNull();
    expect(parseFixtureRid('?rid=', '#/duty')).toBeNull();
  });
});

describe('parseFixtureState', () => {
  beforeEach(() => resetFixtureWarnOnce());

  it('reads the window.search form: /web/?state=empty#/duty', () => {
    // exactly what the browser exposes for that URL:
    expect(parseFixtureState('?state=empty', '#/duty')).toBe('empty');
    // and the raw-URL spellings are tolerated too:
    expect(parseFixtureState('/web/?state=empty#/duty', '')).toBe('empty');
    expect(parseFixtureState('state=ready', '')).toBe('ready');
  });

  it('reads the in-hash query form: #/duty?state=loading', () => {
    expect(parseFixtureState('', '#/duty?state=loading')).toBe('loading');
    expect(parseFixtureState('', '#/employees/e1?tab=x&state=error')).toBe('error');
  });

  it('hash-internal query takes precedence over window.search', () => {
    // window.search survives SPA nav (global switch); the per-view hash query wins.
    expect(parseFixtureState('?state=error', '#/duty?state=empty')).toBe('empty');
  });

  it('missing → null, silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseFixtureState('', '#/duty')).toBeNull();
    expect(parseFixtureState('?tab=usage', '#/duty')).toBeNull();
    expect(parseFixtureState('?state=', '#/duty')).toBeNull(); // empty value = absent
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('invalid → null + console.warn ONCE per distinct bad value (no spam)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseFixtureState('?state=zzz', '')).toBeNull();
    expect(parseFixtureState('?state=zzz', '')).toBeNull(); // repeated: still null
    expect(warn).toHaveBeenCalledTimes(1); // once per DISTINCT bad value
    expect(warn.mock.calls[0]?.[0]).toContain("'zzz'");
    expect(parseFixtureState('?state=42', '')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2); // distinct bad value → its own single warn
    warn.mockRestore();
  });

  it('currentFixtureState reads window.location live', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    history.replaceState(null, '', '/web/?state=error#/duty');
    expect(currentFixtureState()).toBe('error');
    location.hash = '#/duty?state=loading'; // fires hashchange, kept inert here
    expect(currentFixtureState()).toBe('loading');
    history.replaceState(null, '', '/');
    expect(currentFixtureState()).toBeNull();
    warn.mockRestore();
  });
});

/* ----------------------------- pure: resolve ---------------------------- */

describe('resolveFixtureState', () => {
  it('defaults null → ready; passes states through', () => {
    expect(resolveFixtureState(null)).toBe('ready');
    (['loading', 'empty', 'error', 'ready'] as const).forEach((s: FixtureState) => {
      expect(resolveFixtureState(s)).toBe(s);
    });
  });
});

/* --------------------------- pure: fixtureView -------------------------- */

describe('fixtureView', () => {
  it('renders exactly the branch for the state (others untouched)', () => {
    const calls: string[] = [];
    const views = {
      loading: () => {
        calls.push('loading');
        return 'L';
      },
      empty: () => {
        calls.push('empty');
        return 'E';
      },
      error: () => {
        calls.push('error');
        return 'X';
      },
      ready: () => {
        calls.push('ready');
        return 'R';
      },
    } as const;
    expect(fixtureView('empty', views)).toBe('E');
    expect(fixtureView('ready', views)).toBe('R');
    expect(calls).toEqual(['empty', 'ready']); // lazy: unchosen branches never run
  });
});

/* ----------------------- pure: applyFixtureAttribute --------------------- */

describe('applyFixtureAttribute', () => {
  it('sets the data-fixture attribute and removes it on null', () => {
    const el = document.createElement('div');
    applyFixtureAttribute(el, 'loading');
    expect(el.getAttribute('data-fixture')).toBe('loading');
    applyFixtureAttribute(el, 'ready');
    expect(el.getAttribute('data-fixture')).toBe('ready');
    applyFixtureAttribute(el, null);
    expect(el.hasAttribute('data-fixture')).toBe(false);
  });
});

/* ------------------------- React: provider + badge ----------------------- */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetFixtureWarnOnce();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  history.replaceState(null, '', '/');
});

function render(node: ReactNode): void {
  act(() => {
    root.render(node);
  });
}

it('FixtureBadge renders only when the URL override is active', () => {
  history.replaceState(null, '', '/web/#/duty');
  render(createElement(FixtureProvider, null, createElement(FixtureBadge)));
  expect(container.querySelector('[data-testid="shell-fixture-badge"]')).toBeNull();

  history.replaceState(null, '', '/web/?state=loading#/duty');
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const badge = container.querySelector('[data-testid="shell-fixture-badge"]');
  expect(badge).not.toBeNull();
  expect(badge?.getAttribute('data-fixture')).toBe('loading');
  expect(badge?.textContent).toContain('FIXTURE');
  expect(badge?.textContent).toContain('加载中');
});

it('FixtureProvider updates consumers on hashchange-style navigation', () => {
  history.replaceState(null, '', '/web/#/duty');
  function Probe(): ReactNode {
    return useFixtureStateValue();
  }
  render(createElement(FixtureProvider, null, createElement(Probe)));
  expect(container.textContent).toBe('ready');

  // deterministic: jsdom dispatches the real hashchange async, so drive the
  // provider through the same sync path with an explicit popstate.
  history.replaceState(null, '', '/web/#/duty?state=error');
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(container.textContent).toBe('error');
});
