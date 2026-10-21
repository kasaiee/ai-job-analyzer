import React, {useEffect, useRef, useState} from 'react';
import {Check, Copy} from 'lucide-react';
import Button from './Button';

const copyWithFallback = text => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
};

const CopyButton = ({text, label, copiedLabel}) => {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copyText = async () => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      copyWithFallback(text);
    }

    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const accessibleLabel = copied ? copiedLabel : label;
  return (
    <Button
      type="button"
      className={`message-copy-button${copied ? ' copied' : ''}`}
      iconOnly
      onClick={copyText}
      title={accessibleLabel}
      aria-label={accessibleLabel}
    >
      {copied ? <Check size={14}/> : <Copy size={14}/>}
    </Button>
  );
};

export default CopyButton;
