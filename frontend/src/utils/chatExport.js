const getSafeFileName = title => {
  const safeTitle = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 100);

  return `${safeTitle || 'chat'}.txt`;
};

export const formatChatAsText = (conversation, labels) => {
  const separator = '='.repeat(conversation.title.length || 4);
  const messages = (conversation.messages || []).map(message => {
    const author = message.role === 'user' ? labels.user : labels.assistant;
    return `${author}:\n${message.content || ''}`;
  });

  return [conversation.title, separator, ...messages].join('\n\n');
};

export const downloadChatText = (conversation, labels) => {
  const content = formatChatAsText(conversation, labels);
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = getSafeFileName(conversation.title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
