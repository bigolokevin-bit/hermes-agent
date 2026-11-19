// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('knowledge deep-link boot normalisation', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/knowledge');
  });

  it('keeps panel=ingest when reloading a normalised URL', async () => {
    window.history.replaceState({}, '', '/knowledge?tab=spaces&panel=ingest');
    await import('./manifest');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('spaces');
    expect(params.get('panel')).toBe('ingest');
  });

  it('keeps panel=retrieval and panel=evidence on reload', async () => {
    for (const panel of ['retrieval', 'evidence']) {
      vi.resetModules();
      window.history.replaceState({}, '', `/knowledge?tab=spaces&panel=${panel}`);
      await import('./manifest');
      expect(new URLSearchParams(window.location.search).get('panel')).toBe(panel);
    }
  });

  it('maps a cold legacy alias to panel and the shell-known tab', async () => {
    window.history.replaceState({}, '', '/knowledge?tab=retrieval');
    await import('./manifest');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('spaces');
    expect(params.get('panel')).toBe('retrieval');
  });

  it('normalises the hash spelling of a knowledge deep link', async () => {
    const cases: [string, string][] = [
      ['#/knowledge?tab=ingest', 'ingest'],
      ['#/knowledge?tab=sources', 'ingest'],
      ['#/knowledge?tab=retrieval', 'retrieval'],
      ['#/knowledge?tab=citations', 'evidence'],
      ['#/knowledge?tab=evidence', 'evidence'],
      ['#/knowledge?tab=scope', 'spaces'],
    ];
    for (const [hash, panel] of cases) {
      vi.resetModules();
      window.history.replaceState({}, '', `/${hash}`);
      await import('./manifest');
      const next = window.location.hash;
      expect(next.startsWith('#/knowledge?')).toBe(true);
      const params = new URLSearchParams(next.slice('#/knowledge?'.length));
      expect(params.get('tab')).toBe('spaces');
      expect(params.get('panel')).toBe(panel);
    }
  });

  it('keeps a hash panel on reload and leaves other modules alone', async () => {
    window.history.replaceState({}, '', '/#/knowledge?tab=spaces&panel=ingest');
    await import('./manifest');
    expect(window.location.hash).toBe('#/knowledge?tab=spaces&panel=ingest');

    vi.resetModules();
    window.history.replaceState({}, '', '/#/employees?tab=matrix');
    await import('./manifest');
    expect(window.location.hash).toBe('#/employees?tab=matrix');
  });
});
