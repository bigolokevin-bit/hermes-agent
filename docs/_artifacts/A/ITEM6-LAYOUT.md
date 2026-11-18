# R4 item 6 — layout legs (raw ego-browser evidence, build entry assets/index-DoE_SxXx.js)

Run: ~/.local/bin/ego-browser nodejs < laneA-r4-item6.js (server :9119 == pushed tree build)
2026-11-19 ~02:0x. LEG_A = 1280x720 #/overview duty pane; LEG_B/LEG_B2 = 375x812 first screen + drawer.

```
LEG_A_1280 {"vw":1280,"vh":720,"cards":[{"t":"阻塞查看全部","top":644,"bottom":663,"cut":false},{"t":"待我处理","top":644,"bottom":663,"cut":false},{"t":"最近运行","top":644,"bottom":663,"cut":false}],"retry":{"top":349,"bottom":377,"l":280,"r":345,"full":true,"w":66,"h":28},"thirdRow":[{"t":"阻塞查看全部","top":644,"bottom":663,"cut":false},{"t":"待我处理","top":644,"bottom":663,"cut":false},{"t":"最近运行","top":644,"bottom":663,"cut":false}]}
LEG_B_375 {"vw":375,"btns":[{"lab":"打开导航","top":12,"vis":true},{"lab":"Dismiss","top":381,"vis":true},{"lab":"关闭导航","top":12,"vis":true},{"lab":"切换主题","top":736,"vis":true},{"lab":"切换语言","top":748,"vis":true},{"lab":"刷新","top":588,"vis":true}]}
LEG_B2 CLICKED:打开导航 {"mods":["运营总览","数字员工","任务与运行","审批与发布门","人员与访问","知识与数据","能力与接入","系统设置","运营 · 控制台运营总览",""],"chinese":true}
DONE
```

- 1280x720: third-row cards 阻塞查看全部/待我处理/最近运行 top=644 bottom=663 <=720 cut=false; retry button top=349 bottom=377 fully in view (66x28).
- 375: nav trigger is 打开导航 (was 「Open navigation」, i18n en.ts value Chinese-only per L0 ruling); drawer 8 module labels all Chinese; theme/language chrome also Chinese.
