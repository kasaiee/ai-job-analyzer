import React from 'react';

const Button = React.forwardRef(function Button(
  { children, type = 'button', className = '', variant, iconOnly = false, ...props },
  ref,
) {
  const classes = [
    className,
    variant ? `button-${variant}` : '',
    iconOnly ? 'button-icon-only' : '',
  ].filter(Boolean).join(' ');

  return (
    <button ref={ref} type={type} className={classes} {...props}>
      {children}
    </button>
  );
});

export default Button;
