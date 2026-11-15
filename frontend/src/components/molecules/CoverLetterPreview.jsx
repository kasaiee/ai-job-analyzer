import React, { useLayoutEffect, useRef } from 'react';

const CoverLetterPreview = ({ draft, onChange }) => {
  const contentRef = useRef(null);
  const updateField = (field, value) =>
    onChange((current) => ({
      ...current,
      template_data: { ...(current.template_data || {}), [field]: value },
    }));
  const updateContent = (event) => {
    const value = event.currentTarget.innerText;
    onChange((current) => ({ ...current, content: value }));
  };
  const content = String(draft?.content || '');

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (element && document.activeElement !== element && element.innerText !== content) {
      element.innerText = content;
    }
  }, [content]);

  if (!draft) return null;
  const details = draft.template_data || {};
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="cover-letter-print-page cover-letter-preview-document">
      <header className="cover-letter-document-header">
        <div className="resume-identity">
          <h1
            className="cover-letter-header-editable"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Your name"
            onInput={(event) => updateField('sender_name', event.currentTarget.innerText)}
          >
            {details.sender_name || 'Your name'}
          </h1>
          <h2
            className="cover-letter-header-editable"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Target role"
            onInput={(event) => updateField('role', event.currentTarget.innerText)}
          >
            {details.role || 'Target role'}
          </h2>
        </div>
        <div className="cover-letter-contact">
          <span
            className="cover-letter-header-editable"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Email"
            onInput={(event) => updateField('sender_email', event.currentTarget.innerText)}
          >
            {details.sender_email || 'Email'}
          </span>
          <span
            className="cover-letter-header-editable"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Date"
            onInput={(event) => updateField('date', event.currentTarget.innerText)}
          >
            {details.date || 'Date'}
          </span>
        </div>
      </header>
      <div className="cover-letter-recipient">
        <small>APPLICATION</small>
        <strong
          className="cover-letter-header-editable"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Company"
          onInput={(event) => updateField('company', event.currentTarget.innerText)}
        >
          {details.company || 'Company'}
        </strong>
        <span
          className="cover-letter-header-editable"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Role"
          onInput={(event) => updateField('role', event.currentTarget.innerText)}
        >
          {details.role || 'Target role'}
        </span>
      </div>
      <div
        ref={contentRef}
        className="cover-letter-print-content cover-letter-content-editable"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Cover letter content"
        aria-multiline="true"
        onInput={updateContent}
      >
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
};

export default CoverLetterPreview;
