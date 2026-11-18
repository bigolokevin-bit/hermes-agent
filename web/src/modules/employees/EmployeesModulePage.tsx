/**
 * Lane E · employee list module (PRD v4.1 `#/employees`).
 *
 * The upstream shell already ships a real read-only list at
 * `web/src/pages/EmployeesPage.tsx` (matrix → employees fallback, four states,
 * 375-safe). The PRD explicitly names it as the reuse source, so this module is
 * a thin boundary adapter: it keeps the module surface stable while A wires the
 * shell manifest. No data is fetched here.
 */
import EmployeesPage from "@/pages/EmployeesPage";

export function EmployeesModulePage() {
  return <EmployeesPage />;
}

export default EmployeesModulePage;