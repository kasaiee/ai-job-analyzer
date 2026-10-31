/**
 * Advances a column through ascending, descending, and unsorted states.
 *
 * @param {{key: string | null, direction: 'asc' | 'desc' | null}} current
 * @param {string} key
 * @returns {{key: string | null, direction: 'asc' | 'desc' | null}}
 */
export const getNextSortState = (current, key) => {
  if (current.key !== key || current.direction === null) {
    return {key, direction: 'asc'};
  }

  if (current.direction === 'asc') {
    return {key, direction: 'desc'};
  }

  return {key: null, direction: null};
};

/**
 * Returns a sorted copy, or preserves source order when sorting is reset.
 *
 * @template T
 * @param {T[]} items
 * @param {{key: string | null, direction: 'asc' | 'desc' | null}} sort
 * @param {(first: T, second: T, key: string) => number} compare
 * @returns {T[]}
 */
export const applySort = (items, sort, compare) => {
  if (!sort.key || !sort.direction) return [...items];

  const directionMultiplier = sort.direction === 'asc' ? 1 : -1;
  return [...items].sort((first, second) => directionMultiplier * compare(first, second, sort.key));
};
