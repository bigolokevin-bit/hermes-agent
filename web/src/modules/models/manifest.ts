/**
 * models 模型与单价 pane — live module (T28).
 * 价目表与实际扣费分两块：价目表来自模型目录/价格文件，扣费来自平台账本；
 * 两块各自标来源与 asOf，页面不做单价 × 用量的推算。
 *
 * reuse: /v1/models
 * reuse: /v1/models/pricing
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'models',
  tabs: [
    {
      id: 'models',
      label: '模型与单价',
      route: '#/models',
      kind: 'reuse',
      reuse: () => import('./ModelsModulePage').then((m) => ({ default: m.ModelsModulePage })),
      dataSource: '/api/models 目录 + /api/models/pricing 价格表（fixture 门：接口 404/不可达）',
    },
  ],
};

export default manifest;