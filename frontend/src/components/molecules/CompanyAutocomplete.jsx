import React, { useEffect, useState } from 'react';
import Button from '../atoms/Button';
import CompanyLogo from '../atoms/CompanyLogo';

function CompanyAutocomplete({ value, selectedId, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!query || selectedId) {
      setSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/companies/?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!cancelled) setSuggestions(data.companies || []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [value, selectedId]);

  const chooseSuggestion = (company) => {
    onSelect(company);
    setSuggestions([]);
  };

  return (
    <div className="company-autocomplete">
      <input
        name="company_name"
        required
        maxLength="200"
        value={value}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
      />
      {focused && suggestions.length > 0 && (
        <div className="company-suggestions">
          {suggestions.map((company) => (
            <Button
              key={company.id}
              type="button"
              onMouseDown={() => chooseSuggestion(company)}
            >
              <CompanyLogo name={company.name} src={company.has_brand_image ? company.logo_url : ''}/>
              <span>{company.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompanyAutocomplete;
