/**
 * Test harness for `ConsoleSelect` (and any other hand-drawn listbox).
 *
 * WHY it exists: the console's filters moved off the native `<select>`
 * protocol (`element.value = …` + a dispatched `change`) onto the same
 * interaction a keyboard user has — activate the combobox trigger, then pick a
 * `role="option"`. These helpers keep that two-step short in every suite that
 * drives a filter, and assert on what the user sees: `selectValue` reads the
 * value the control holds (`data-value`), `selectText` the label it shows.
 *
 * It is imported by tests only; nothing in the app runtime reaches it.
 */

import { act } from "react";

function trigger(testId: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-testid='${testId}']`);
  if (node === null) throw new Error(`ConsoleSelect trigger [data-testid='${testId}'] is not on screen`);
  return node;
}

async function click(node: Element): Promise<void> {
  await act(async () => {
    (node as HTMLElement).click();
  });
  await act(async () => {});
}

/** The currently visible `role="option"` labels, in DOM order. */
export function optionTexts(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[role='option']")].map(
    (node) => (node.textContent ?? "").trim(),
  );
}

/** The currently visible option values, in DOM order — the control keeps the
 * machine handle in `data-value` and the human label on screen. */
export function optionValues(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[role='option']")].map(
    (node) => node.getAttribute("data-value") ?? "",
  );
}

export async function openSelect(testId: string): Promise<void> {
  await click(trigger(testId));
}

export async function closeSelect(testId: string): Promise<void> {
  if (trigger(testId).getAttribute("aria-expanded") === "true") await click(trigger(testId));
}

/**
 * Open the control and choose the option labelled `optionText` (exact match
 * first, then substring, so a suite can say 「暂停」 or 「服务带回 20 条」).
 * Throws with the real option list when nothing matches — a renamed label is a
 * decision the suite must notice, not a silent pass.
 */
export async function pickOption(testId: string, optionText: string): Promise<void> {
  await click(trigger(testId));
  const options = [...document.querySelectorAll<HTMLElement>("[role='option']")];
  const labels = options.map((node) => (node.textContent ?? "").trim());
  const index =
    labels.indexOf(optionText) >= 0
      ? labels.indexOf(optionText)
      : labels.findIndex((label) => label.includes(optionText));
  if (index < 0) {
    throw new Error(
      `[${testId}] has no option matching ${JSON.stringify(optionText)} — on screen: ${JSON.stringify(labels)}`,
    );
  }
  await click(options[index]!);
}

/**
 * The same interaction addressed by the option's value — for suites that
 * speak in server parameters (`actor=employee-api`, `limit=25`) rather than
 * in the labels on screen.
 */
export async function pickByValue(testId: string, value: string): Promise<void> {
  await click(trigger(testId));
  const options = [...document.querySelectorAll<HTMLElement>("[role='option']")];
  const option = options.find((node) => node.getAttribute("data-value") === value);
  if (option === undefined) {
    throw new Error(
      `[${testId}] has no option with value ${JSON.stringify(value)} — offered: ${JSON.stringify(
        options.map((node) => node.getAttribute("data-value")),
      )}`,
    );
  }
  await click(option);
}

/** The value the control holds — what the old `element.value` read. */
export function selectValue(testId: string): string {
  return trigger(testId).getAttribute("data-value") ?? "";
}

/** The label the control shows — what the old `selectedOptions[0].text` read. */
export function selectText(testId: string): string {
  return (trigger(testId).textContent ?? "").trim();
}

export function selectDisabled(testId: string): boolean {
  return trigger(testId).hasAttribute("disabled");
}

export function selectExpanded(testId: string): boolean {
  return trigger(testId).getAttribute("aria-expanded") === "true";
}

/** The control's tooltip, which is where this console keeps its explanations. */
export function selectTitle(testId: string): string {
  return trigger(testId).getAttribute("title") ?? "";
}
