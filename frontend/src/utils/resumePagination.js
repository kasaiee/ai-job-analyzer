/** Group measured resume blocks into pages without splitting an individual block. */
export const paginateResumeBlocks = (blockHeights, pageHeight) => {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) return [blockHeights.map((_, index) => index)];

  const pages = [];
  let page = [];
  let usedHeight = 0;

  blockHeights.forEach((height, index) => {
    const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
    if (page.length && usedHeight + safeHeight > pageHeight) {
      pages.push(page);
      page = [];
      usedHeight = 0;
    }
    page.push(index);
    usedHeight += safeHeight;
  });

  if (page.length || !pages.length) pages.push(page);
  return pages;
};

/** Remove stale block indexes left over while React switches resume versions. */
export const validResumePageIndexes = (page, blockCount) => (page || [])
  .filter(index => Number.isInteger(index) && index >= 0 && index < blockCount);
