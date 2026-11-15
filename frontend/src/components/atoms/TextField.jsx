import React, { useState } from 'react';
import { textDirection } from '../../utils/textDirection';

/**
 * Text field or text area with automatic direction.
 *
 * The field renders as `<textarea>` when `multiline` is set, otherwise as `<input>`.
 * The direction is derived from the content: as soon as the value contains even one
 * Persian character the field is RTL, otherwise it stays LTR. An explicit `dir`
 * prop always takes precedence over the automatic detection.
 *
 * All other props (className, placeholder, onChange, onKeyDown, refs, ...) are
 * forwarded to the underlying element, so it can be used anywhere a plain
 * `<input>`/`<textarea>` would be used.
 */
const TextField = (
  { multiline = false, rows = 4, dir, value, defaultValue, onChange, ...rest },
  ref
) => {
  const controlled = value !== undefined;
  const [typed, setTyped] = useState(defaultValue ?? '');
  const current = controlled ? value : typed;
  const direction = dir ?? textDirection(current);
  const Element = multiline ? 'textarea' : 'input';
  const props = {
    ...rest,
    ref,
    dir: direction,
    onChange: (event) => {
      if (!controlled) setTyped(event.currentTarget.value);
      onChange?.(event);
    },
    ...(multiline ? { rows } : { type: rest.type || 'text' }),
  };
  if (controlled) props.value = value;
  else if (defaultValue !== undefined) props.defaultValue = defaultValue;
  return <Element {...props} />;
};

export default React.forwardRef(TextField);
