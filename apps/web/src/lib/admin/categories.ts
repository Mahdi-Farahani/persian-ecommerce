import type { CategoryNode } from '@pe/shared';
import type { AdminCategory } from './types';

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  isActive: boolean;
  /** Indented label suitable for a `<select>`. */
  label: string;
}

const INDENT = '   ';

function indentLabel(name: string, depth: number): string {
  return depth > 0 ? `${INDENT.repeat(depth)}└ ${name}` : name;
}

/** Depth-first flattening of a category tree preserving sibling order. */
export function flattenCategoryTree(nodes: CategoryNode[], depth = 0): CategoryOption[] {
  const result: CategoryOption[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      depth,
      parentId: node.parentId,
      isActive: node.isActive,
      label: indentLabel(node.name, depth),
    });
    result.push(...flattenCategoryTree(node.children, depth + 1));
  }
  return result;
}

/**
 * Orders a flat category list depth-first (parents before their children,
 * siblings by sortOrder then name) so it can be rendered as an indented tree.
 */
export function orderCategoriesAsTree<T extends AdminCategory>(categories: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'));
  }
  const result: T[] = [];
  const visit = (parentId: string | null) => {
    for (const category of byParent.get(parentId) ?? []) {
      result.push(category);
      visit(category.id);
    }
  };
  visit(null);
  // Orphans (parent missing from the list) are appended so nothing disappears.
  const seen = new Set(result.map((c) => c.id));
  for (const category of categories) {
    if (!seen.has(category.id)) result.push(category);
  }
  return result;
}

/** Ids of a category and all of its descendants (used to prevent cycles). */
export function descendantIds(categories: AdminCategory[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function categoryOptionsFromFlat(categories: AdminCategory[]): CategoryOption[] {
  return orderCategoriesAsTree(categories).map((c) => ({
    id: c.id,
    name: c.name,
    depth: c.depth,
    parentId: c.parentId,
    isActive: c.isActive,
    label: indentLabel(c.name, c.depth),
  }));
}
