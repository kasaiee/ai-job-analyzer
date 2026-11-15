import React from 'react';
import {ArrowLeft} from 'lucide-react';
import Button from '../atoms/Button';

/**
 * Page header row: optional back button, title with optional subtitle, and an actions slot pinned to the end.
 * Props: title (node), subtitle (node), onBack (fn), backLabel (string), children (actions, e.g. an ActionMenu).
 */
const PageHeader = ({title, subtitle = null, onBack, backLabel = 'Back', children = null}) => <div className="analysis-page-head">
  <div className="analysis-page-title">
    {onBack && <Button type="button" variant="ghost" iconOnly onClick={onBack} aria-label={backLabel} title={backLabel}><ArrowLeft size={18}/></Button>}
    <div><h2>{title}</h2>{subtitle && <small>{subtitle}</small>}</div>
  </div>
  {children && <div className="analysis-page-actions">{children}</div>}
</div>;

export default PageHeader;
