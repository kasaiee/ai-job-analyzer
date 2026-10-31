const PERSIAN_CHARACTER_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/** Render the entire text RTL when it contains at least one Persian character. */
export const textDirection = (content = '') => PERSIAN_CHARACTER_PATTERN.test(String(content)) ? 'rtl' : 'ltr';
