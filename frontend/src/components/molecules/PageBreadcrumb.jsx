import React from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import Button from '../atoms/Button';
import { useLanguage } from '../../templates/LanguageProvider';

const PageBreadcrumb = ({ items, onNavigate }) => {
  const { t } = useLanguage();

  return (
    <nav className="page-breadcrumb" aria-label={t('directoryBreadcrumb')}>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;

        return (
          <React.Fragment key={item.id || 'root'}>
            {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
            <Button
              type="button"
              className={isCurrent ? 'current' : ''}
              onClick={() => !isCurrent && onNavigate(item.id)}
              disabled={isCurrent}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {index === 0 && <Folder size={15} />} {item.name}
            </Button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default PageBreadcrumb;
