
## R10 尾项：/audit?tab=verify 接线（fix(console): wire audit verify tab）
接线（写域 App.tsx/shell，routes.ts/registry/manifest 零写入，未新增 Tab 行）：App.tsx lazy AuditVerifyConsolePage（named AuditVerifyModulePage from modules/audit/AuditVerifyModulePage，aud 页体未改）；console Routes 块 /audit compat 后新增 /audit/verify 与 /verify Navigate to=/system?tab=verify replace（first-in-tree wins 先例 /matrix /models）。读数：定向 shell 33 passed；全量 121 files/1194 passed 0 fail；assert-ia HTML/REACT 双 exit0（51/22/1/8）；tsc web 单包 0；9122 served=旧代次（DW4fkEEp），新代次上屏需 L0 合批后 build+D 重章。
