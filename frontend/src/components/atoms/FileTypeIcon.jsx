import React from 'react';
import {File, FileImage, FileText} from 'lucide-react';
import {useLanguage} from '../../templates/LanguageProvider';

export const isImageFile = file => file.mime_type?.startsWith('image/');

export const isPdfFile = file => (
  file.mime_type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
);

const FileTypeIcon = ({file, size = 20, className = ''}) => {
  const {t} = useLanguage();
  if (isPdfFile(file)) {
    return (
      <span className={`file-type-icon pdf-file-icon ${className}`} aria-label={t('pdfFile')}>
        <FileText size={size}/>
        <small>PDF</small>
      </span>
    );
  }

  if (isImageFile(file)) {
    return <FileImage className={`file-type-icon image-file-icon ${className}`} size={size} aria-label={t('imageFile')}/>;
  }

  return <File className={`file-type-icon generic-file-icon ${className}`} size={size} aria-label={t('genericFile')}/>;
};

export default FileTypeIcon;
