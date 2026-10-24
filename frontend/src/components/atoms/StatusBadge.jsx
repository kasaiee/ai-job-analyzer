import React from 'react';

const StatusBadge = ({value, kind = 'status'}) => <span className={`status-badge ${kind}-${String(value || '').toLowerCase()}`}>
  {String(value || '').replaceAll('_', ' ')}
</span>;

export default StatusBadge;
