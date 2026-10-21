import React, {useEffect, useState} from 'react';

const getInitials = (name = '') => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map(part => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

const CompanyLogo = ({name, src, size = 'small', className = ''}) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [src]);

  const showImage = Boolean(src) && !imageFailed;

  return (
    <span className={`company-logo ${size} ${className}`.trim()} aria-hidden="true">
      {showImage && <img src={src} alt="" onError={() => setImageFailed(true)}/>}
      {!showImage && <span>{getInitials(name)}</span>}
    </span>
  );
};

export default CompanyLogo;
