/** Normalize common AI spacing artifacts without changing the letter's wording. */
export const normalizeCoverLetterText = value => String(value || '')
  .replace(/([\p{L}\p{N}])-\s+([\p{L}\p{N}])/gu, '$1-$2')
  .replace(/^\s*1\s*(?:\n+|$)/, '')
  .replace(/\b(Sincerely|Best regards|Kind regards|Yours sincerely|Yours faithfully),?[ \t]+(?=\S)/gi, '$1,\n\n')
  .replace(/([^\n])\s+([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})(?=\s|$)/gu, '$1\n$2')
  .trim();

export const coverLetterParagraphs = value => normalizeCoverLetterText(value)
  .split(/\n\s*\n/)
  .filter(Boolean);

/** Split editable letter text into fields used by the shared preview/PDF template. */
export const parseCoverLetter = value => {
  const normalized = normalizeCoverLetterText(value);
  const email = normalized.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || '';
  const closingMatches = [...normalized.matchAll(/(?:^|\n)\s*(Sincerely|Best regards|Kind regards|Yours sincerely|Yours faithfully),?\s*(?:\n|$)/gi)];
  const closingMatch = closingMatches.at(-1);
  const body = closingMatch ? normalized.slice(0, closingMatch.index).trim() : normalized;
  const signatureLines = closingMatch ? normalized.slice(closingMatch.index + closingMatch[0].length).split('\n').map(line => line.trim()).filter(Boolean) : [];
  const signatureEmail = signatureLines.find(line => /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(line)) || '';
  const signatureName = signatureLines.find(line => line !== signatureEmail && !/\d/.test(line)) || '';

  return {
    bodyParagraphs: body.split(/\n\s*\n/).filter(Boolean),
    closing: closingMatch ? `${closingMatch[1]},` : 'Sincerely,',
    name: signatureName,
    email: signatureEmail || email,
  };
};
