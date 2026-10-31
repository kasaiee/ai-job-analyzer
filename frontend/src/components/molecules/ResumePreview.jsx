import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {formatEducationPeriod, formatResumeDate} from '../../utils/educationPeriod';
import {formatContactLink} from '../../utils/resumeContact';
import {paginateResumeBlocks, validResumePageIndexes} from '../../utils/resumePagination';

const PLACEHOLDER_PATTERN = /\[ADD [^\]]+\]/;

const PlaceholderText = ({ children }) => {
  const parts = String(children || '').split(/(\[ADD [^\]]+\])/g);

  return <>{parts.map((part, index) => (
    part.startsWith('[ADD ')
      ? <span className="resume-placeholder" key={index}>{part}</span>
      : part
  ))}</>;
};

const EditableText = ({children, editable, onChange, className}) => editable
  ? <span className={`resume-editable${className ? ` ${className}` : ''}`} contentEditable suppressContentEditableWarning role="textbox" tabIndex="0" onBlur={event=>onChange?.(event.currentTarget.textContent)}>{children}</span>
  : <span className={className}><PlaceholderText>{children}</PlaceholderText></span>;

const EditableCharacter = ({children, editable, onChange}) => <EditableText className="resume-editable-character" editable={editable} onChange={onChange}>{children}</EditableText>;

const DEFAULT_SECTION_TITLES = {
  summary: 'Professional Summary',
  skills: 'Core Skills',
  experience: 'Professional Experience',
  teaching_experience: 'Teaching Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  languages: 'Languages',
};

const webLinkTarget = value => {
  const text = String(value || '').trim();
  if (!text || PLACEHOLDER_PATTERN.test(text)) return null;

  const target = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  return /^https?:\/\//i.test(target) ? target : null;
};

const ContactLink = ({ children, href, external = false }) => {
  if (!href) return <PlaceholderText>{children}</PlaceholderText>;

  return (
    <a
      className="resume-contact-link"
      href={href}
      rel={external ? 'noreferrer' : undefined}
      target={external ? '_blank' : undefined}
    >
      {children}
    </a>
  );
};

const ContactLine = ({ contact }) => {
  const items = [];
  const email = String(contact.email || '').trim();
  const phone = String(contact.phone || '').trim();

  if (email) {
    const href = PLACEHOLDER_PATTERN.test(email) ? null : `mailto:${email}`;
    items.push(<ContactLink href={href} key="email">{email}</ContactLink>);
  }
  if (phone || contact.location) {
    const dialablePhone = phone.replace(/[^\d+]/g, '');
    const href = PLACEHOLDER_PATTERN.test(phone) || !dialablePhone
      ? null
      : `tel:${dialablePhone}`;
    items.push(
      <span className="resume-contact-paired" key="phone-location">
        {phone && <ContactLink href={href}>{phone}</ContactLink>}
        {phone && contact.location && <span aria-hidden="true"> | </span>}
        {contact.location && <PlaceholderText>{contact.location}</PlaceholderText>}
      </span>,
    );
  }
  (contact.links || []).filter(Boolean).forEach((link, index) => {
    items.push(
      <ContactLink external href={webLinkTarget(link)} key={`link-${index}`}>
        {formatContactLink(link)}
      </ContactLink>,
    );
  });

  return <>{items.map((item, index) => (
    <span className="resume-contact-item" key={index}>{item}</span>
  ))}</>;
};

const EditableContactLink = ({children, href, onChange, external = false}) => <a
  className="resume-contact-link resume-editable"
  contentEditable
  href={href || undefined}
  rel={external ? 'noreferrer' : undefined}
  suppressContentEditableWarning
  target={external ? '_blank' : undefined}
  onBlur={event=>onChange(event.currentTarget.textContent)}
>{children}</a>;

const EditableContactLine = ({contact, onContactChange}) => {
  const email=String(contact.email||'');
  const phone=String(contact.phone||'');
  const dialablePhone=phone.replace(/[^\d+]/g,'');
  const updateLink=(index,value)=>onContactChange('links',(contact.links||[]).map((link,itemIndex)=>itemIndex===index?value:link));
  return <>
    <span className="resume-contact-item"><EditableContactLink href={!PLACEHOLDER_PATTERN.test(email)&&email?`mailto:${email}`:null} onChange={value=>onContactChange('email',value)}>{email}</EditableContactLink></span>
    <span className="resume-contact-item"><span className="resume-contact-paired"><EditableContactLink href={!PLACEHOLDER_PATTERN.test(phone)&&dialablePhone?`tel:${dialablePhone}`:null} onChange={value=>onContactChange('phone',value)}>{phone}</EditableContactLink>{phone&&contact.location&&<span aria-hidden="true"> | </span>}<EditableText editable onChange={value=>onContactChange('location',value)}>{contact.location}</EditableText></span></span>
    {(contact.links||[]).map((link,index)=><span className="resume-contact-item" key={`link-${index}`}><EditableContactLink external href={webLinkTarget(link)} onChange={value=>updateLink(index,value)}>{link}</EditableContactLink></span>)}
  </>;
};

const ResumeHeader = ({contact, editable, onContactChange}) => <header>
  <div className="resume-identity">
    <h1><EditableText editable={editable} onChange={value=>onContactChange('name',value)}>{contact.name || '[ADD NAME]'}</EditableText></h1>
    <h2><EditableText editable={editable} onChange={value=>onContactChange('headline',value)}>{contact.headline}</EditableText></h2>
  </div>
  <p className="resume-contact" dir="ltr">{editable?<EditableContactLine contact={contact} onContactChange={onContactChange}/>:<ContactLine contact={contact} />}</p>
</header>;

const ResumeEntryLine = ({item, organizationField, editable, onChange, organizationSeparator, onOrganizationSeparatorChange, dateSeparator, onDateSeparatorChange}) => <p className="resume-entry-line">
  <span className="resume-entry-title"><b><EditableText editable={editable} onChange={value=>onChange('role',value)}>{item.role}</EditableText></b><span className="resume-entry-organization"><EditableText editable={editable} onChange={value=>onChange(organizationField,value)}>{item[organizationField]}</EditableText>{(item.location||editable)&&<><EditableCharacter editable={editable} onChange={onOrganizationSeparatorChange}>{organizationSeparator}</EditableCharacter><EditableText editable={editable} onChange={value=>onChange('location',value)}>{item.location}</EditableText></>}</span></span>
  <span className="resume-entry-date"><EditableText editable={editable} onChange={value=>onChange('start_date',value)}>{formatResumeDate(item.start_date)}</EditableText><EditableCharacter editable={editable} onChange={onDateSeparatorChange}>{dateSeparator}</EditableCharacter><EditableText editable={editable} onChange={value=>onChange('end_date',value)}>{formatResumeDate(item.end_date)}</EditableText></span>
</p>;

const addResumeEntries = (blocks, sectionKey, title, entries, organizationField, editable, onTitleChange, onItemChange, onBulletChange, symbol, updateSymbol) => {
  entries?.forEach((item, index) => {
    blocks.push({
      key: `${sectionKey}-${index}-heading`,
      content: <div>{index === 0 && <h3><EditableText editable={editable} onChange={value=>onTitleChange(sectionKey,value)}>{title}</EditableText></h3>}<ResumeEntryLine item={item} organizationField={organizationField} editable={editable} onChange={(field,value)=>onItemChange(sectionKey,index,field,value)} organizationSeparator={symbol(`${sectionKey}.${index}.organization_separator`, ' — ')} onOrganizationSeparatorChange={value=>updateSymbol(`${sectionKey}.${index}.organization_separator`,value)} dateSeparator={symbol(`${sectionKey}.${index}.date_separator`, '–')} onDateSeparatorChange={value=>updateSymbol(`${sectionKey}.${index}.date_separator`,value)} /></div>,
    });
    item.bullets?.forEach((bullet, bulletIndex) => blocks.push({
      key: `${sectionKey}-${index}-bullet-${bulletIndex}`,
      content: <ul className="resume-single-bullet"><li><EditableText editable={editable} onChange={value=>onBulletChange(sectionKey,index,bulletIndex,value)}>{bullet.text}</EditableText></li></ul>,
    }));
  });
};

const buildResumeBlocks = (data, editable, onContactChange, onFieldChange, onItemChange, onBulletChange) => {
  const blocks = [{key: 'header', content: <ResumeHeader contact={data.contact || {}} editable={editable} onContactChange={onContactChange} />}];
  const sectionTitle = section => data.section_titles?.[section] || DEFAULT_SECTION_TITLES[section];
  const updateSectionTitle = (section, value) => onFieldChange('section_titles', {...(data.section_titles || {}), [section]: value});
  const symbol = (key, fallback) => Object.prototype.hasOwnProperty.call(data.body_symbols || {}, key) ? data.body_symbols[key] : fallback;
  const updateSymbol = (key, value) => onFieldChange('body_symbols', {...(data.body_symbols || {}), [key]: value});
  if (data.professional_summary) blocks.push({key: 'summary', content: <section><h3><EditableText editable={editable} onChange={value=>updateSectionTitle('summary',value)}>{sectionTitle('summary')}</EditableText></h3><p><EditableText editable={editable} onChange={value=>onFieldChange('professional_summary',value)}>{data.professional_summary}</EditableText></p></section>});
  if (data.skills?.length) blocks.push({key: 'skills', content: <section><h3><EditableText editable={editable} onChange={value=>updateSectionTitle('skills',value)}>{sectionTitle('skills')}</EditableText></h3><p>{data.skills.map((item,index)=><React.Fragment key={index}>{index>0&&<EditableCharacter editable={editable} onChange={value=>updateSymbol(`skills.${index}.separator`,value)}>{symbol(`skills.${index}.separator`,' • ')}</EditableCharacter>}<EditableText editable={editable} onChange={value=>onItemChange('skills',index,'name',value)}>{item.name}</EditableText></React.Fragment>)}</p></section>});
  addResumeEntries(blocks, 'experience', sectionTitle('experience'), data.experience, 'company', editable, updateSectionTitle, onItemChange, onBulletChange, symbol, updateSymbol);
  addResumeEntries(blocks, 'teaching_experience', sectionTitle('teaching_experience'), data.teaching_experience, 'institution', editable, updateSectionTitle, onItemChange, onBulletChange, symbol, updateSymbol);
  data.projects?.forEach((item, index) => {
    blocks.push({key: `project-${index}-heading`, content: <div>{index === 0 && <h3><EditableText editable={editable} onChange={value=>updateSectionTitle('projects',value)}>{sectionTitle('projects')}</EditableText></h3>}<p><b><EditableText editable={editable} onChange={value=>onItemChange('projects',index,'name',value)}>{item.name}</EditableText></b>{(item.description||editable)&&<><EditableCharacter editable={editable} onChange={value=>updateSymbol(`projects.${index}.separator`,value)}>{symbol(`projects.${index}.separator`,' — ')}</EditableCharacter><EditableText editable={editable} onChange={value=>onItemChange('projects',index,'description',value)}>{item.description}</EditableText></>}</p></div>});
    item.bullets?.forEach((bullet, bulletIndex) => blocks.push({key: `project-${index}-bullet-${bulletIndex}`, content: <ul className="resume-single-bullet"><li><EditableText editable={editable} onChange={value=>onBulletChange('projects',index,bulletIndex,value)}>{bullet.text}</EditableText></li></ul>}));
  });
  data.education?.forEach((item, index) => blocks.push({key: `education-${index}`, content: <div>{index === 0 && <h3><EditableText editable={editable} onChange={value=>updateSectionTitle('education',value)}>{sectionTitle('education')}</EditableText></h3>}<p className="resume-entry-line"><span className="resume-entry-title"><b><EditableText editable={editable} onChange={value=>onItemChange('education',index,'degree',value)}>{item.degree}</EditableText></b><span><EditableText editable={editable} onChange={value=>onItemChange('education',index,'institution',value)}>{item.institution}</EditableText></span></span><span className="resume-entry-date"><EditableText editable={editable} onChange={value=>onItemChange('education',index,'period',value)}>{formatEducationPeriod(item.period)}</EditableText></span></p></div>}));
  data.certifications?.forEach((item, index) => blocks.push({key: `certification-${index}`, content: <div>{index === 0 && <h3><EditableText editable={editable} onChange={value=>updateSectionTitle('certifications',value)}>{sectionTitle('certifications')}</EditableText></h3>}<p className="resume-entry-line"><span><b><EditableText editable={editable} onChange={value=>onItemChange('certifications',index,'name',value)}>{item.name}</EditableText></b>{(item.issuer||editable)&&<><EditableCharacter editable={editable} onChange={value=>updateSymbol(`certifications.${index}.separator`,value)}>{symbol(`certifications.${index}.separator`,' — ')}</EditableCharacter><EditableText editable={editable} onChange={value=>onItemChange('certifications',index,'issuer',value)}>{item.issuer}</EditableText></>}</span>{(item.date||editable)&&<span className="resume-entry-date"><EditableText editable={editable} onChange={value=>onItemChange('certifications',index,'date',value)}>{formatEducationPeriod(item.date)}</EditableText></span>}</p></div>}));
  if (data.languages?.length) blocks.push({key: 'languages', content: <section><h3><EditableText editable={editable} onChange={value=>updateSectionTitle('languages',value)}>{sectionTitle('languages')}</EditableText></h3><p>{data.languages.map((item,index)=><React.Fragment key={index}>{index>0&&<EditableCharacter editable={editable} onChange={value=>updateSymbol(`languages.${index}.separator`,value)}>{symbol(`languages.${index}.separator`,' • ')}</EditableCharacter>}<EditableText editable={editable} onChange={value=>onItemChange('languages',index,'name',value)}>{item.name}</EditableText><EditableCharacter editable={editable} onChange={value=>updateSymbol(`languages.${index}.level_separator`,value)}>{symbol(`languages.${index}.level_separator`,': ')}</EditableCharacter><EditableText editable={editable} onChange={value=>onItemChange('languages',index,'level',value)}>{item.level}</EditableText></React.Fragment>)}</p></section>});
  return blocks;
};

const ResumePreview = ({ data, pageSize, editable = false, onContactChange = ()=>{}, onFieldChange = ()=>{}, onItemChange = ()=>{}, onBulletChange = ()=>{} }) => {
  const measurementRef = useRef(null);
  const blocks = useMemo(() => buildResumeBlocks(data, editable, onContactChange, onFieldChange, onItemChange, onBulletChange), [data, editable, onContactChange, onFieldChange, onItemChange, onBulletChange]);
  const [pages, setPages] = useState([blocks.map((_, index) => index)]);

  useLayoutEffect(() => {
    const measurementPage = measurementRef.current;
    if (!measurementPage) return undefined;

    const measure = () => {
      const style = getComputedStyle(measurementPage);
      const availableHeight = parseFloat(style.minHeight) - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const heights = Array.from(measurementPage.children).map(element => {
        const elementStyle = getComputedStyle(element);
        return element.getBoundingClientRect().height + parseFloat(elementStyle.marginTop) + parseFloat(elementStyle.marginBottom);
      });
      setPages(paginateResumeBlocks(heights, availableHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(measurementPage);
    return () => observer.disconnect();
  }, [blocks, pageSize]);

  return (
    <div className="resume-preview-pages" dir="ltr">
      <article ref={measurementRef} className={`resume-preview resume-preview-measure resume-page-${pageSize.toLowerCase()}`} aria-hidden="true">
        {blocks.map(block => <div className="resume-preview-block" key={block.key}>{block.content}</div>)}
      </article>
      {pages.map((page, pageIndex) => <article className={`resume-preview resume-page-${pageSize.toLowerCase()}`} aria-label={`Resume page ${pageIndex + 1}`} key={pageIndex}>
        {validResumePageIndexes(page, blocks.length).map(blockIndex => <div className="resume-preview-block" key={blocks[blockIndex].key}>{blocks[blockIndex].content}</div>)}
      </article>)}
    </div>
  );
};

export default ResumePreview;
