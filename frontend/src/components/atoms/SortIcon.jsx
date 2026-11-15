import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * Displays the sort state for a table column.
 */
const SortIcon = ({ column, sort }) => {
  if (sort?.key !== column) {
    return <ArrowUpDown size={13} />;
  }

  return sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
};

export default SortIcon;
