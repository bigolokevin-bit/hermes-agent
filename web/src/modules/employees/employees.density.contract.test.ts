// 契约测试：员工列表的密度口径（L0 13:05 解阻令的四条验收）。
// 断言的是「档位」而不是像素字面量：换数值可以，掉档不行。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** 闸 FONT_SCALE 现钉的六档：令牌序号 → px（TOKENS 4bb80ebb2d 裁决）。 */
const STEPS: ReadonlyArray<readonly [string, number]> = [
  ['1', 12],
  ['2', 13],
  ['3', 14],
  ['4', 16],
  ['5', 20],
  ['6', 24],
];
/** 只数会定字号的六个工具类；text-white/50 之类是颜色类，不参与字阶判据。 */
const LADDER = ['xs', 'sm', 'base', 'lg', 'xl', '2xl'] as const;

const page = readFileSync(
  fileURLToPath(new URL('./EmployeesModulePage.tsx', import.meta.url)),
  'utf8',
);
const density = readFileSync(
  fileURLToPath(new URL('./employees-density.css', import.meta.url)),
  'utf8',
);
const tokens = readFileSync(
  fileURLToPath(new URL('../../styles/tokens.css', import.meta.url)),
  'utf8',
);

/** 取一条 CSS 规则的花括号体。 */
function ruleBody(selector: string): string {
  const at = density.indexOf(selector + ' {');
  expect(at, 'rule missing: ' + selector).toBeGreaterThanOrEqual(0);
  const open = density.indexOf('{', at);
  return density.slice(open + 1, density.indexOf('}', open));
}

describe('employees list density contract (L0 13:05)', () => {
  it('keeps the filter card on a single row', () => {
    expect(page).toContain('emp-filter-row');
    expect(ruleBody('.emp-filter-row')).toContain('flex-wrap: nowrap');
    // 单行不等于溢出看不见：行内必须有横滚壳兜底。
    expect(ruleBody('.emp-filter-row')).toContain('overflow-x: auto');
    // 部门 rail 自己不再换行成第二排，胶囊不收缩、不折字。
    expect(page).toContain('emp-dept-rail');
    expect(ruleBody('.emp-dept-rail')).toContain('flex-wrap: nowrap');
    expect(ruleBody('.emp-dept-rail > button')).toContain('flex-shrink: 0');
  });

  it('serves control heights from the tokens, not from utility guesses', () => {
    // 令牌文件写得很紧凑：`--btn-h:32px`，冒号后没有空格。
    expect(tokens).toContain('--btn-h:32px');
    expect(tokens).toContain('--btn-h-inline:28px');
    expect(ruleBody('.emp-filter-control')).toContain('height: var(--btn-h)');
    expect(page).toContain('emp-filter-control');
  });

  it('uses only the six registered type steps and no arbitrary size', () => {
    // 只数会定字号的那六个工具类；text-white/50 之类是颜色类，不参与字阶判据。
    const used = LADDER.filter((step) => page.includes('text-' + step));
    expect(used.length).toBeGreaterThan(0);
    // 任意值字号（text-[13px]）会绕开六档；text-[var(--color-*)] 仍是颜色。
    for (const tail of page.split('text-[').slice(1)) {
      expect(tail.startsWith('var(--color'), 'arbitrary font-size class').toBe(true);
    }
    // 六档在令牌里齐备（按令牌自己的紧凑形制取值）。
    for (const [index, px] of STEPS) {
      expect(
        tokens.includes('--font-size-' + index + ':' + px + 'px'),
        'no step at ' + px + 'px',
      ).toBe(true);
    }
  });

  it('never falls back to a native select', () => {
    expect(page).not.toContain('<select');
    expect(page).toContain('ConsoleSelect');
  });

  it('keeps at most one page-level primary button', () => {
    const primary = page.split('variant="primary"').length - 1;
    expect(primary).toBeLessThanOrEqual(1);
  });
});
