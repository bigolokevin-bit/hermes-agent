# approvals 折叠态 375 逐元素取证（READY-BACKLOG 条目3）

- 端口 9122；entry index-Dm2Mt71f.js；脸 939852e620 (lane/console-aud atop, docs-only merges since ed5527e7 build face)；视口 375x812；判据 per-element boundingRect right<=376 && left>=-1 (offscreen-left right<=1 exempt); fullPage shots
- 读数：四形全部 viol=0（v1 折叠默认 / v2 q=nomatch-xyz / v3 展开 / v4 risk=high）；折叠态 apv-filter-toggle 可见 right=116~122，apv-reset-filters 可见在界内；展开态 apv-filter-panel right=353<=376。
- 如实注记：部署 bundle（ed5527e7 构建脸）里 apv8-search-empty / apv-risk-empty 卡片尚未上线（该两卡与 apv-summary-row 折叠护栏来自更新后的源码，随下次构建入脸）；v2/v4 帧中两卡 present=false 为部署代次差，非布局裁切。空态卡折叠态可见性由 jsdom 护栏锁定（lane/console-aud 02ce8ce032，40/40 绿）。
- 队列「清空筛选」=实现「重置筛选」常显钮（apv-reset-filters）；空态卡内另有「清空搜索/清空风险档」就地出口。

- v1-collapsed: viol=0 url=/approvals mainLen=344
- v2-search-empty: viol=0 url=/approvals?q=nomatch-xyz mainLen=347
- v3-expanded: viol=0 url=/approvals mainLen=None
- v4-risk-empty: viol=0 url=/approvals?risk=high mainLen=347
