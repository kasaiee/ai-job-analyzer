import React from 'react';

/**
 * Displays a short error message in the app's shared error style.
 */
const ErrorMessage = ({ message, as: Tag = 'div', className = '' }) => {
  if (!message) return null;

  const classes = ['error', className].filter(Boolean).join(' ');
  return <Tag className={classes}>{message}</Tag>;
};

export default ErrorMessage;
