import React from 'react';
import Button from './Button';

const ViewToggle = ({value, options, onChange, label}) => (
  <div className="view-toggle" role="group" aria-label={label}>
    {options.map(option => (
      <Button
        key={option.value}
        type="button"
        className={value === option.value ? 'selected' : ''}
        aria-pressed={value === option.value}
        aria-label={option.label}
        onClick={() => onChange(option.value)}
        title={option.label}
      >
        {option.icon}
      </Button>
    ))}
  </div>
);

export default ViewToggle;
