import React from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';

const DEFAULT_PAGE_SIZES = [10, 25, 50];

const Pagination = ({page, pageCount, pageSize, onPageChange, onPageSizeChange, label, pageSizes = DEFAULT_PAGE_SIZES}) => {
  const {language, t} = useLanguage();
  const locale = language === 'fa' ? 'fa-IR' : 'en-US';

  return (
    <nav className="table-pagination" aria-label={label}>
      <label className="page-size-control">
        <span>{t('itemsPerPage')}</span>
        <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
          {pageSizes.map(size => <option key={size} value={size}>{size.toLocaleString(locale)}</option>)}
        </select>
      </label>
      <div className="page-navigation">
        <Button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="directional-icon" size={16}/>{t('previous')}
        </Button>
        <span>{t('pageOf', {page: page.toLocaleString(locale), total: pageCount.toLocaleString(locale)})}</span>
        <Button type="button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
          {t('next')}<ChevronRight className="directional-icon" size={16}/>
        </Button>
      </div>
    </nav>
  );
};

export default Pagination;
