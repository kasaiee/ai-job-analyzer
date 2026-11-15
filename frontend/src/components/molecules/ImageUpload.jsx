import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';

function ImageUpload({ name, label, initialPreview = '', onChange }) {
  const {t} = useLanguage();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(initialPreview);

  useEffect(() => {
    setPreview(initialPreview);
  }, [initialPreview]);

  const handleChange = (event) => {
    const file = event.target.files?.[0] || null;
    onChange?.(file);

    if (!file) {
      setPreview(initialPreview);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  const clearImage = () => {
    if (inputRef.current) inputRef.current.value = '';
    setPreview(initialPreview);
    onChange?.(null);
  };

  return (
    <div className="image-upload">
      <span className="image-upload-label">{label || t('image')}</span>
      <div className="image-upload-control">
        {preview ? (
          <img className="image-upload-preview" src={preview} alt={t('selectedPreview')} />
        ) : (
          <span className="image-upload-placeholder"><ImageIcon size={20} /></span>
        )}
        <div className="image-upload-actions">
          <Button type="button" onClick={() => inputRef.current?.click()}>
            {preview ? t('changeImage') : t('chooseImage')}
          </Button>
          {preview && (
            <Button type="button" onClick={clearImage} aria-label={t('removeImage')}>
              <X size={16} />
            </Button>
          )}
        </div>
      </div>
      <input ref={inputRef} name={name} type="file" accept="image/*" hidden onChange={handleChange} />
    </div>
  );
}

export default ImageUpload;
