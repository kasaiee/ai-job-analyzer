export const formatMemoryAsReadableText = (items) => {
  const children = new Map();
  items.forEach((item) => {
    const key = item.parent_id || '';
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(item);
  });
  const sortNodes = (nodes) =>
    [...nodes].sort(
      (a, b) => Number(a.is_leaf) - Number(b.is_leaf) || a.name.localeCompare(b.name),
    );
  const lines = [];
  const walk = (parentId, path) => {
    sortNodes(children.get(parentId) || []).forEach((node) => {
      if (node.is_leaf) {
        lines.push(`${[...path, node.name].join(' / ')}\n${'-'.repeat(20)}\n${node.content}`, '');
      } else {
        walk(node.id, [...path, node.name]);
      }
    });
  };
  walk('', []);
  return lines.join('\n').trim() + '\n';
};
