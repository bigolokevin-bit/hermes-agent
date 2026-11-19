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
});
