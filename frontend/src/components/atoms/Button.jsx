import React from 'react';

export const buildButtonClassName = ({className = '', variant, iconOnly = false}) => [
  className,
  variant ? 'button-control' : '',
  variant ? `button-${variant}` : '',
  iconOnly ? 'button-icon-only' : '',
].filter(Boolean).join(' ');

const Button = React.forwardRef(function Button(
  { children, type = 'button', className = '', variant, iconOnly = false, ...props },
  ref,
) {
  const classes = buildButtonClassName({className, variant, iconOnly});

  return (
    <button ref={ref} type={type} className={classes} {...props}>
      {children}
    </button>
  );
});

export default Button;
