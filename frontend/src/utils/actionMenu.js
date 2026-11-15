export const MENU_ALIGNMENTS = ['start', 'end'];

export const actionMenuAlignment = align => (MENU_ALIGNMENTS.includes(align) ? align : 'end');

export const isMenuCloseKey = key => key === 'Escape';

export const isOutsideMenu = (menuElement, target) => !menuElement?.contains(target);
