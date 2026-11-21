#!/usr/bin/env node
// check-authstate.mjs — 登录态（playwright storageState）有效性 preflight
// 用途：在跑 shots / UI-QA 取图 / obs 归因之前，先确认手里的票还没过期。
//       教训来源：docs/_artifacts/ui-qa/R-OBS-authstate-6c626741.md —— 台账 auth 面长期
//       指向已过期的 v4-auth-state.json，导致 auth≈anon，归因绕远路。
// 只读：本脚本不写任何文件、不发网络请求、不打印 cookie 值。
//
// 用法：
//   node docs/_artifacts/ui-qa/check-authstate.mjs                 # 检查默认 ui-qa 登录态
//   node docs/_artifacts/ui-qa/check-authstate.mjs --state=<path>  # 检查指定文件
//   node docs/_artifacts/ui-qa/check-authstate.mjs --all           # 同时检查 ui-qa 与 v4 两份
//   node docs/_artifacts/ui-qa/check-authstate.mjs --json          # 机器可读输出（供脚本消费）
//   可加 --warn-before=<小时>：剩余有效期低于该阈值时也判过期（默认 0 = 只看是否已过期）
//
// 退出码：0 = 有效（全部可判定的 cookie 都在有效期内）
//         1 = 已过期（或剩余低于阈值）
//         2 = 文件缺失 / JSON 不可解析 / 没有 cookies 数组

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const DIR = process.env.SEKOI_OPS_DIR || resolve(homedir(), '.local/state/sekoi-ops');
const KNOWN = {
  'ui-qa': resolve(DIR, 'ui-qa-auth-state.json'),
  'v4': resolve(DIR, 'v4-auth-state.json'),
};

const argv = process.argv.slice(2);
const flag = name => argv.find(a => a === `--${name}`) !== undefined;
const opt = (name, dflt) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const asJson = flag('json');
const warnBeforeH = Number(opt('warn-before', '0')) || 0;

const nowS = Math.floor(Date.now() / 1000);
const iso = s => new Date(s * 1000).toISOString().replace('T', ' ').slice(0, 19);
const human = s => (s >= 3600 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s / 60)}m`);

/** 解 JWT payload 的 exp（不校验签名，只取声明）；非 JWT 返回 null */
function jwtExp(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return typeof payload.exp === 'number'
      ? { exp: payload.exp, sub: payload.sub ?? null, iss: payload.iss ?? null }
      : null;
  } catch {
    return null;
  }
}

function inspect(path) {
  const res = { file: path, ok: false, status: 'unknown', cookies: [], note: '' };
  let st = null;
  try {
    st = statSync(path);
  } catch {
    res.status = 'missing';
    res.note = '文件不存在或不可读';
    return res;
  }
  res.size = st.size;
  res.mtime = st.mtime.toISOString().replace('T', ' ').slice(0, 19);
  res.mode = (st.mode & 0o777).toString(8);

  let data = null;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    res.status = 'unparsable';
    res.note = `JSON 解析失败：${e.message}`;
    return res;
  }
  const cookies = Array.isArray(data.cookies) ? data.cookies : null;
  if (!cookies) {
    res.status = 'no-cookies';
    res.note = 'storageState 里没有 cookies 数组';
    return res;
  }

  let expired = 0;
  let unknown = 0;
  let soon = 0;
  for (const c of cookies) {
    const jwt = jwtExp(c.value);
    // expires 优先取 storageState 字段；-1/缺失时退回 JWT 声明
    const srcE = typeof c.expires === 'number' && c.expires > 0 ? c.expires : null;
    const exp = srcE ?? (jwt ? jwt.exp : null);
    const row = {
      name: c.name,
      domain: c.domain ?? null,
      path: c.path ?? null,
      source: srcE ? 'storageState' : jwt ? 'jwt.exp' : 'none',
      expires: exp,
      expiresAt: exp ? iso(exp) : null,
      remaining: exp ? exp - nowS : null,
      session: !exp,
      subject: jwt ? (typeof jwt.sub === 'string' ? jwt.sub : JSON.stringify(jwt.sub ?? null)) : null,
      issuer: jwt ? jwt.iss ?? null : null,
    };
    if (!exp) {
      unknown += 1;
    } else if (exp <= nowS) {
      expired += 1;
    } else if (warnBeforeH && exp - nowS <= warnBeforeH * 3600) {
      soon += 1;
    }
    res.cookies.push(row);
  }

  res.ok = expired === 0 && soon === 0;
  res.status = expired > 0 ? 'expired' : soon > 0 ? 'expiring-soon' : unknown === cookies.length ? 'session-only' : 'valid';
  res.counts = { total: cookies.length, expired, soon, unknown };
  if (expired) res.note = `${expired} 枚 cookie 已过期 —— 需要重登产出新 state`;
  else if (soon) res.note = `剩余有效期低于 --warn-before=${warnBeforeH}h 阈值`;
  else if (unknown === cookies.length) res.note = '全是会话级 cookie，无法离线判定有效期';
  else res.note = `全部有效，最短剩余 ${human(Math.min(...res.cookies.filter(c => c.remaining !== null).map(c => c.remaining)))}`;
  return res;
}

const targets = flag('all')
  ? Object.entries(KNOWN).map(([alias, p]) => ({ alias, path: p }))
  : [{ alias: 'default', path: resolve(opt('state', KNOWN['ui-qa'])) }];

const results = targets.map(t => ({ alias: t.alias, ...inspect(t.path) }));

if (asJson) {
  console.log(JSON.stringify({ checkedAt: iso(nowS), epoch: nowS, warnBeforeH, results }, null, 2));
} else {
  console.log(`# authstate preflight — 判定时刻 ${iso(nowS)}（epoch ${nowS}，时间为 UTC，北京时间 = +8h）`);
  for (const r of results) {
    console.log(`\n[${r.alias}] ${r.file}`);
    if (typeof r.size === 'number') console.log(`  文件：${r.size}B  mtime=${r.mtime}  权限=${r.mode}`);
    console.log(`  状态：${r.status.toUpperCase()}  ${r.note}`);
    for (const c of r.cookies) {
      const left = c.remaining === null ? '不可判定' : c.remaining <= 0 ? `已过期 ${human(-c.remaining)}` : `剩 ${human(c.remaining)}`;
      console.log(`  - ${c.name} @ ${c.domain || '?'}${c.path || ''}  到期 ${c.expiresAt || '—'}（取处 ${c.source}）  ${left}`);
      if (c.subject && c.subject !== 'null') console.log(`      subject=${c.subject}${c.issuer ? ` issuer=${c.issuer}` : ''}`);
    }
  }
  console.log('\n判定口径：401 = 鉴权/登录态问题（先看这里）；404 = 上游未接线读口（与 cookie 无关）。');
}

const worst = results.reduce((acc, r) => {
  if (['missing', 'unparsable', 'no-cookies'].includes(r.status)) return Math.max(acc, 2);
  if (!r.ok) return Math.max(acc, 1);
  return acc;
}, 0);
process.exit(worst);
