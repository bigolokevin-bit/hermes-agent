/**
 * knowledge 治理·知识库组 manifests — IA group 6/8 (PRD §3 rows 12-14, GAP-03).
 * '#/knowledge' conflicts with the existing App route (upstream KnowledgePage);
 * precedence settled stage 2: the CONSOLE path renders this shell module, the
 * legacy '/knowledge' React route keeps serving upstream pages untouched.
 */
import type { ModuleManifest } from '../../shell/registry';

/**
 * R22: the shell bridge rewrites `?tab=retrieval|citations|evidence` to its
 * legacy evidence tab (and `sources` to a planned pane), so a cold deep link
 * never reaches this module's panels. The shell files are outside this lane's
 * write domain, so the knowledge deep-link query is normalised here instead,
 * before the App renders: the rewrite pins the outer tab that owns the requested
 * panel (`tab=` for the highlight, `panel=` for the face), which the module treats
 * as its source of truth. `?tab=evidence` is deliberately NOT touched — that
 * address belongs to the shell's 审计证据 tab in another module.
 *
 * Two spellings arrive: the path form `/knowledge?tab=…` and the hash form
 * `#/knowledge?tab=…` (what the crawl and the console rail use). The hash form is
 * normalised too, otherwise the alias sends `?tab=ingest` to a planned placeholder
 * and `?tab=evidence` to another module before this page ever mounts.
 */
const KNOWLEDGE_PANELS: Record<string, KnowledgePanel> = {
  sources: 'ingest',
  ingest: 'ingest',
  retrieval: 'retrieval',
  search: 'retrieval',
  citations: 'evidence',
  evidence: 'evidence',
  scope: 'spaces',
  spaces: 'spaces',
};

type KnowledgePanel = 'spaces' | 'ingest' | 'retrieval' | 'evidence';

/** The outer knowledge tabs this module's panels are allowed to pin. */
type KnowledgeTabId = 'spaces' | 'sources';

/**
 * UX r7 判词①：外层高亮只读 `?tab=`（shell/console.tsx 取 `sp.get('tab')`），所以归一
 * 结果不能把四个面板一律压成 `tab=spaces` —— 那会让高亮落在「知识空间」而内容开在另一面。
 * 每个面板因此钉住它自己的外层 Tab，与壳侧 compat 条目同配（routes.ts：`ingest` → `sources`，
 * `retrieval`/`citations` → `spaces`）。
 */
const KNOWLEDGE_PANEL_TO_TAB: Record<KnowledgePanel, KnowledgeTabId> = {
  spaces: 'spaces',
  ingest: 'sources',
  retrieval: 'spaces',
  evidence: 'spaces',
};

/** `?tab=evidence`（审计证据）是壳侧另一个模块的地址，没有显式 panel 时不归本模块改写。 */
const FOREIGN_TAB = 'evidence';

/**
 * rewrite the address without ever risking the boot. A document that is still
 * settling its own history entry can reject `replaceState` carrying the previous
 * entry's state; that must not take the app down, because the page itself also
 * resolves the panel straight from `?tab=`.
 */
function replaceKnowledgeUrl(next: string): void {
  try {
    window.history.replaceState(window.history.state ?? null, '', next);
  } catch {
    // leave the address as it is; the module still opens the requested panel
  }
}

function panelOf(current: string | null, raw: string | null): KnowledgePanel | null {
  const byPanel = KNOWLEDGE_PANELS[(current ?? '').toLowerCase()];
  if (byPanel) return byPanel;
  return KNOWLEDGE_PANELS[(raw ?? '').toLowerCase()] ?? null;
}

/**
 * 把一次归一算到底：返回 true 表示地址需要改写。已对齐（外层 Tab 就是该面板的归属 Tab，
 * 且 panel 已写明）时返回 false，避免 replaceState 抖动。
 */
function applyKnowledgeDeepLink(params: URLSearchParams): boolean {
  const rawTab = (params.get('tab') ?? '').toLowerCase();
  const panel = panelOf(params.get('panel'), params.get('tab'));
  if (panel === null) return false;
  if (rawTab === FOREIGN_TAB && !params.has('panel')) return false;
  const owningTab = KNOWLEDGE_PANEL_TO_TAB[panel];
  if (rawTab === owningTab && params.get('panel') === panel) return false;
  params.set('tab', owningTab);
  params.set('panel', panel);
  return true;
}

function normaliseKnowledgeDeepLink(): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash ?? '';
  const hashMatch = /^#\/knowledge(?:\?.*)?$/.test(hash);
  const pathMatch = /\/knowledge\/?$/.test(window.location.pathname);
  if (!hashMatch && !pathMatch) return;

  if (pathMatch) {
    const params = new URLSearchParams(window.location.search);
    if (!applyKnowledgeDeepLink(params)) return;
    replaceKnowledgeUrl(`${window.location.pathname}?${params.toString()}${hash}`);
    return;
  }

  const queryStart = hash.indexOf('?');
  const path = queryStart === -1 ? hash : hash.slice(0, queryStart);
  const params = new URLSearchParams(queryStart === -1 ? '' : hash.slice(queryStart + 1));
  if (!applyKnowledgeDeepLink(params)) return;
  replaceKnowledgeUrl(`${window.location.pathname}${window.location.search}${path}?${params.toString()}`);
}

normaliseKnowledgeDeepLink();

const manifest: ModuleManifest = {
  module: 'knowledge',
  tabs: [
    {
      id: 'spaces',
      label: '知识空间',
      route: '#/knowledge',
      kind: 'planned',
      group: 'knowledge',
      icon: 'Library',
      dataSource: '知识空间与文档登记、知识库检索与引用读取（真实读取，未接入时显示原因）',
    },
    {
      id: 'sources',
      label: '数据源',
      route: '#/knowledge?tab=sources',
      kind: 'planned',
      group: 'knowledge',
      icon: 'Database',
      dataSource: '文档与数据接入登记（读取接口未开放，显示诚实未接入）',
    },
    {
      id: 'evidence',
      label: '证据与引用',
      route: '#/knowledge?tab=evidence',
      kind: 'reuse',
      group: 'knowledge',
      icon: 'Quote',
      reuse: () => import('../evidence/EvidenceModulePage').then((m) => ({ default: m.EvidenceModulePage })),
      dataSource: '运行事件引用与审计接口',
    },
  ],
};

export default manifest;
