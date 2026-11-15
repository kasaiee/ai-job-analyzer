import React from 'react';
import {Search, X} from 'lucide-react';
import Button from './Button';
import {useLanguage} from '../../templates/LanguageProvider';

const SearchInput = ({value, onChange, placeholder, label}) => {
  const {t} = useLanguage();
  return (
  <label className="search-input">
    <Search size={17} aria-hidden="true"/>
    <span className="sr-only">{label}</span>
    <input
      type="search"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
    />
    {value && <Button type="button" onClick={() => onChange('')} aria-label={t('clearSearch')}><X size={15}/></Button>}
  </label>
  );
};

export default SearchInput;
