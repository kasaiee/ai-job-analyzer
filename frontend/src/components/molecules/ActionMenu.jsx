import React, {useEffect, useRef, useState} from 'react';
import {ChevronDown} from 'lucide-react';
import Button from '../atoms/Button';
import {actionMenuAlignment, isMenuCloseKey, isOutsideMenu} from '../../utils/actionMenu';

/**
 * Button that opens a popover of actions next to itself.
 * Children should be `<Button role="menuitem" variant="ghost" />` items; the menu closes after any click.
 * Props: label (trigger text), icon (optional leading icon node), align ('start' | 'end' edge of the trigger).
 */
const ActionMenu = ({label = 'Actions', icon = null, align = 'end', children}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = event => {
      if (isOutsideMenu(menuRef.current, event.target)) setOpen(false);
    };
    const closeOnEscape = event => {
      if (isMenuCloseKey(event.key)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return <div className="action-menu" ref={menuRef}>
    <Button variant="secondary" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}>
      {icon}{label}<ChevronDown size={16} aria-hidden="true"/>
    </Button>
    {open && <div className={`action-menu-popover action-menu-popover-${actionMenuAlignment(align)}`} role="menu" onClick={() => setOpen(false)}>{children}</div>}
  </div>;
};

export default ActionMenu;
