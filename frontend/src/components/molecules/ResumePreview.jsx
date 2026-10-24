import React from 'react';

const PLACEHOLDER_PATTERN = /\[ADD [^\]]+\]/;

const PlaceholderText = ({ children }) => {
  const parts = String(children || '').split(/(\[ADD [^\]]+\])/g);

  return <>{parts.map((part, index) => (
    part.startsWith('[ADD ')
      ? <span className="resume-placeholder" key={index}>{part}</span>
      : part
  ))}</>;
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
  if (phone) {
    const dialablePhone = phone.replace(/[^\d+]/g, '');
    const href = PLACEHOLDER_PATTERN.test(phone) || !dialablePhone
      ? null
      : `tel:${dialablePhone}`;
    items.push(<ContactLink href={href} key="phone">{phone}</ContactLink>);
  }
  if (contact.location) {
    items.push(<PlaceholderText key="location">{contact.location}</PlaceholderText>);
  }
  (contact.links || []).filter(Boolean).forEach((link, index) => {
    items.push(
      <ContactLink external href={webLinkTarget(link)} key={`link-${index}`}>
        {link}
      </ContactLink>,
    );
  });

  return <>{items.map((item, index) => (
    <React.Fragment key={index}>
      {index > 0 && <span aria-hidden="true"> | </span>}
      {item}
    </React.Fragment>
  ))}</>;
};

const ResumePreview = ({ data, pageSize }) => {
  const contact = data.contact || {};

  return (
    <article className={`resume-preview resume-page-${pageSize.toLowerCase()}`} dir="ltr">
      <header>
        <h1><PlaceholderText>{contact.name || '[ADD NAME]'}</PlaceholderText></h1>
        <h2><PlaceholderText>{contact.headline}</PlaceholderText></h2>
        <p><ContactLine contact={contact} /></p>
      </header>
      {data.professional_summary && <section><h3>Professional Summary</h3><p><PlaceholderText>{data.professional_summary}</PlaceholderText></p></section>}
      {data.skills?.length > 0 && <section><h3>Core Skills</h3><p>{data.skills.map(item => item.name).join(' • ')}</p></section>}
      {data.experience?.length > 0 && <section><h3>Professional Experience</h3>{data.experience.map((item, index) => <div className="resume-entry" key={index}><div className="resume-entry-head"><b><PlaceholderText>{item.role}</PlaceholderText> — <PlaceholderText>{item.company}</PlaceholderText></b><span><PlaceholderText>{item.start_date}</PlaceholderText>–<PlaceholderText>{item.end_date}</PlaceholderText></span></div>{item.location && <small><PlaceholderText>{item.location}</PlaceholderText></small>}<ul>{item.bullets?.map((bullet, bulletIndex) => <li key={bulletIndex}><PlaceholderText>{bullet.text}</PlaceholderText></li>)}</ul></div>)}</section>}
      {data.projects?.length > 0 && <section><h3>Projects</h3>{data.projects.map((item, index) => <div className="resume-entry" key={index}><b><PlaceholderText>{item.name}</PlaceholderText></b>{item.description && <p><PlaceholderText>{item.description}</PlaceholderText></p>}<ul>{item.bullets?.map((bullet, bulletIndex) => <li key={bulletIndex}><PlaceholderText>{bullet.text}</PlaceholderText></li>)}</ul></div>)}</section>}
      {data.education?.length > 0 && <section><h3>Education</h3>{data.education.map((item, index) => <div className="resume-entry-head" key={index}><b><PlaceholderText>{item.degree}</PlaceholderText> — <PlaceholderText>{item.institution}</PlaceholderText></b><span><PlaceholderText>{item.period}</PlaceholderText></span></div>)}</section>}
      {data.certifications?.length > 0 && <section><h3>Certifications</h3><p>{data.certifications.map(item => item.name).join(' • ')}</p></section>}
      {data.languages?.length > 0 && <section><h3>Languages</h3><p>{data.languages.map(item => `${item.name}: ${item.level}`).join(' • ')}</p></section>}
    </article>
  );
};

export default ResumePreview;
