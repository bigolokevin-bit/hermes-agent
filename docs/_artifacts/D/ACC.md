
## R60 — 机械腿（c37e6d49 / entry BM-aDKf1，2026-11-20 19:5x，append-only 原始 stdout）

```text
$ git rev-parse HEAD
c37e6d493139c19a8c442602e11f1989f9c551ed
$ git ls-remote origin refs/heads/lane/hermes-console
c37e6d493139c19a8c442602e11f1989f9c551ed	refs/heads/lane/hermes-console
$ stat -f "%z %N" hermes_cli/web_dist/assets/index-BM-aDKf1.js hermes_cli/web_dist/assets/index-SO5tnBWA.css
168872 hermes_cli/web_dist/assets/index-BM-aDKf1.js
135015 hermes_cli/web_dist/assets/index-SO5tnBWA.css
$ shasum -a 256 hermes_cli/web_dist/assets/index-BM-aDKf1.js
71289bd3db385505f5743960ddf66ed667c0307828c53a7aceccb4cc3c6dff55  hermes_cli/web_dist/assets/index-BM-aDKf1.js
$ curl -s http://127.0.0.1:9122/ | grep -o "index-[A-Za-z0-9_-]*.js" | head -1
index-BM-aDKf1.js
$ curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9122/
200
```
