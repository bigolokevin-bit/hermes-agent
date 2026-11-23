/**
 * UI-F 基元层出口。页面只从这里取件：
 *   import { UiButton, UiSelect, UiTable, StateBlock } from "@/components/ui";
 * 样式也在这里挂（App.tsx 与 index.css 不属本层写域）：
 * 先挂 tokens.css 令牌契约，再挂 ui.css 形状层，页面无需自己 import CSS。
 */
import "../../styles/tokens.css";
import "./ui.css";

export {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@nous-research/ui";
export { UiButton, type UiButtonProps, type UiButtonVariant } from "./Button";
export { UiInput } from "./Input";
export { UiSelect, type UiSelectOption, type UiSelectProps } from "./Select";
export { StateBlock, type UiStateTone } from "./StateBlock";
export { UiTable, type UiTableColumn, type UiTableProps } from "./Table";
export { UiTextarea, TextareaVariants, type TextareaProps, type UiTextareaSize } from "./Textarea";
// DS 的 Tabs/TabsList/TabsTrigger 只作历史兼容出口：它们不写 role="tablist"/"tab"、
// 不接方向键、并把 value 解构后弃用（盘上 dist/ui/components/tabs.js 为证）。
// 新页面请一律用下面的 UiTabs（键盘与 ARIA 由基元层补齐）。
export { UiTabs, type UiTabItem, type UiTabsProps } from "./Tabs";

export { UiCard, UiCardRow } from "./Card";
export type { UiCardProps, UiCardRowProps } from "./Card";
