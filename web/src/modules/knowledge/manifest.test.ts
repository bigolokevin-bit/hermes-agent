// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initialTab } from './knowledge';

/** The same panel resolution the page uses when the address never got rewritten. */
function initialTabFrom(params: URLSearchParams): string {
  return initialTab(params.get('tab'), params.get('panel'));
}

describe('knowledge deep-link boot normalisation', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/knowledge');
  });

  // UX r7 判词①：外层高亮只看 ?tab=，所以面板必须和它的外层 Tab 同源。
  it('re-pins the owning outer tab when an old flat address is reloaded', async () => {
    window.history.replaceState({}, '', '/knowledge?tab=spaces&panel=ingest');
    await import('./manifest');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('sources');
    expect(params.get('panel')).toBe('ingest');
  });

  it('leaves an address that is already aligned alone', async () => {
    for (const url of [
      '/knowledge?tab=sources&panel=ingest',
      '/knowledge?tab=spaces&panel=retrieval',
      '/knowledge?tab=spaces&panel=evidence',
    ]) {
      vi.resetModules();
      window.history.replaceState({}, '', url);
      await import('./manifest');
      expect(window.location.search).toBe(url.slice(url.indexOf('?')));
    }
  });

  it('does not absorb the outer 审计证据 address', async () => {
    window.history.replaceState({}, '', '#/knowledge?tab=evidence');
    await import('./manifest');
    expect(window.location.hash).toBe('#/knowledge?tab=evidence');
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
    // 外层高亮只看 ?tab=，所以归一结果里 tab 必须是该面板的外层 Tab（r7 判词①）。
    const cases: [string, string, string][] = [
      ['#/knowledge?tab=ingest', 'sources', 'ingest'],
      ['#/knowledge?tab=sources', 'sources', 'ingest'],
      ['#/knowledge?tab=retrieval', 'spaces', 'retrieval'],
      ['#/knowledge?tab=citations', 'spaces', 'evidence'],
      ['#/knowledge?tab=scope', 'spaces', 'spaces'],
    ];
    for (const [hash, tab, panel] of cases) {
      vi.resetModules();
      window.history.replaceState({}, '', `/${hash}`);
      await import('./manifest');
      const next = window.location.hash;
      expect(next.startsWith('#/knowledge?')).toBe(true);
      const params = new URLSearchParams(next.slice('#/knowledge?'.length));
      expect(params.get('tab')).toBe(tab);
      expect(params.get('panel')).toBe(panel);
    }
  });

  it('survives a history that refuses the rewrite', async () => {
    window.history.replaceState({}, '', '/knowledge?tab=retrieval');
    const original = window.history.replaceState;
    window.history.replaceState = (() => {
      throw new Error('cannot create a history state object in this document');
    }) as typeof window.history.replaceState;
    try {
      await expect(import('./manifest')).resolves.toBeTruthy();
      // the address is left alone, and the module still resolves the panel itself
      expect(new URLSearchParams(window.location.search).get('tab')).toBe('retrieval');
    } finally {
      window.history.replaceState = original;
    }
    expect(initialTabFrom(new URLSearchParams(window.location.search))).toBe('retrieval');
  });

  it('keeps a hash panel on reload and leaves other modules alone', async () => {
    window.history.replaceState({}, '', '/#/knowledge?tab=sources&panel=ingest');
    await import('./manifest');
    expect(window.location.hash).toBe('#/knowledge?tab=sources&panel=ingest');

    vi.resetModules();
    window.history.replaceState({}, '', '/#/employees?tab=matrix');
    await import('./manifest');
    expect(window.location.hash).toBe('#/employees?tab=matrix');
  });
});

describe('knowledge panel truth table accessors', () => {
  // L0 裁定：壳侧要同一张表时从本模块取，不再复制 KNOWLEDGE_PANEL_TO_TAB。
  it('answers the owning outer tab for a raw address value', async () => {
    const { knowledgeOuterTab } = await import('./manifest');
    expect(knowledgeOuterTab('ingest')).toBe('sources');
    expect(knowledgeOuterTab('sources')).toBe('sources');
    expect(knowledgeOuterTab('spaces')).toBe('spaces');
    expect(knowledgeOuterTab('scope')).toBe('spaces');
    expect(knowledgeOuterTab('retrieval')).toBe('spaces');
    expect(knowledgeOuterTab('search')).toBe('spaces');
    expect(knowledgeOuterTab('evidence')).toBe('spaces');
    expect(knowledgeOuterTab('citations')).toBe('spaces');
  });

  it('answers null for anything that is not this module panel', async () => {
    const { knowledgeOuterTab } = await import('./manifest');
    expect(knowledgeOuterTab('approvals')).toBeNull();
    expect(knowledgeOuterTab('')).toBeNull();
    expect(knowledgeOuterTab(null)).toBeNull();
    expect(knowledgeOuterTab(undefined)).toBeNull();
    // 原型链上的键不算面板（constructor 会取到 Object 构造函数）
    expect(knowledgeOuterTab('constructor')).toBeNull();
  });

  it('is read-only: it never rewrites the address', async () => {
    const { knowledgeOuterTab } = await import('./manifest');
    const before = window.location.search;
    knowledgeOuterTab('ingest');
    expect(window.location.search).toBe(before);
  });
});
