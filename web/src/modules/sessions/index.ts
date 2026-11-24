/**
 * sessions 模块出口（SE-02）。
 *
 * 页面接线（属 modules/employee-detail 写域，归页面车道）：
 *   import { SessionsList } from "@/modules/sessions";
 *   <SessionsList employeeId={empId} />
 * 该组件自读 `/agent-api/api/console-sessions`，无需外部传 resource。
 */

export {
  CONSOLE_SESSIONS_URL,
  DEFAULT_SESSIONS_LIMIT,
  MAX_SESSIONS_LIMIT,
  MISSING_PLACEHOLDER,
  buildSessionsUrl,
  fetchSessionDetail,
  fetchSessionsPage,
  filterSessionRows,
  formatMessageCount,
  formatSessionTime,
  parseSessionDetail,
  parseSessionsPage,
  sessionDetailUrl,
  shortSessionId,
  type SessionDetailView,
  type SessionMessageView,
  type SessionRow,
  type SessionsPage,
  type SessionsQuery,
} from "./sessionsApi";
export { SessionsList, type SessionsListProps } from "./SessionsList";