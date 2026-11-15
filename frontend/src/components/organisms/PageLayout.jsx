import React from 'react';

/**
 * Shared page shell for application pages.
 *
 * Page-specific toolbars and content remain children, while the page width,
 * spacing, scrolling behavior, and optional breadcrumb slot stay consistent.
 */
const PageLayout = ({
  children,
  className = '',
  breadcrumbs = null,
  search = null,
  actions = null,
}) => {
  return (
    <div className="page-scroll">
      <section className={`page-layout ${className}`.trim()}>
        {breadcrumbs}
        {(search || actions) && (
          <div className="page-controls page-toolbar-row page-search-row">
            {search}
            {actions && <div className="page-toolbar-actions">{actions}</div>}
          </div>
        )}
        {children}
      </section>
    </div>
  );
};

export default PageLayout;
