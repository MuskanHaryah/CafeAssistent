import type { MenuItem, SelectedModifier } from '../types';

/**
 * Render the list of modifier option names for a given item + selection.
 * Example: ["Large", "Oat Milk"]
 */
export function modifierNames(
  item: MenuItem | undefined,
  modifiers: SelectedModifier[] | undefined,
): string[] {
  if (!item || !modifiers || modifiers.length === 0) return [];
  const out: string[] = [];
  for (const sel of modifiers) {
    const group = item.modifierGroups?.find((g) => g.id === sel.groupId);
    if (!group) continue;
    for (const oid of sel.optionIds) {
      const opt = group.options.find((o) => o.id === oid);
      if (opt) out.push(opt.name);
    }
  }
  return out;
}

/** Join modifier names with a middle-dot separator. */
export function modifierSummary(
  item: MenuItem | undefined,
  modifiers: SelectedModifier[] | undefined,
): string {
  return modifierNames(item, modifiers).join(' · ');
}
