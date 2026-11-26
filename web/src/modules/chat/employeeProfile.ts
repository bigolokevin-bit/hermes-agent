/**
 * 员工 ↔ Hermes profile 的命名与建档约定（一处定义，两处使用）。
 *
 * 为什么单独成文件：新建员工的模态与对话页都需要这套规则，但对话页会连带
 * 拉起整个 ChatPage 宿主，从模态里 import 它会把聊天打包进名册页。
 *
 * 命名规则：员工 id 常带大写十六进制，不是合法 profile 名，所以取尾段 8 位转小写，
 * 前缀 emp-。同一员工每次都映射到同一个名字（幂等，不随刷新变化）。
 */

/** 建档时写进 description 的标记：只有带这句的档，人格才归控制台管。 */
export const CONSOLE_PROFILE_MARK = "控制台自动创建";

export function employeeProfileName(employeeId: string): string | null {
  const tail = employeeId
    .replace(/^(?:emp|run|rn|task|apr|aud|cs|session)[_:-]?/i, "")
    .replace(/[^0-9a-z]/gi, "")
    .toLowerCase()
    .slice(0, 8);
  return tail ? `emp-${tail}` : null;
}

export function employeeProfileDescription(employeeId: string): string {
  return `数字员工 ${employeeId} 的独立对话档（${CONSOLE_PROFILE_MARK}）`;
}

/** 是否为控制台建的档（决定「人格归控制台管」这件事）。 */
export function isConsoleProfile(description: unknown): boolean {
  return typeof description === "string" && description.includes(CONSOLE_PROFILE_MARK);
}
