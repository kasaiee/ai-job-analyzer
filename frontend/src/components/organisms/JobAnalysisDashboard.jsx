import React from 'react';
import ScoreBar from '../atoms/ScoreBar';
import StatusBadge from '../atoms/StatusBadge';
import RadarChart from '../molecules/RadarChart';

const scoreLabels = {
  skills_match_score: 'Skills', experience_match_score: 'Experience', seniority_match_score: 'Seniority',
  domain_match_score: 'Domain', culture_soft_skills_score: 'Culture',
};

const ListSection = ({title, items}) => items?.length ? <section className="analysis-panel">
  <h3>{title}</h3><ul className="analysis-list">{items.map((item, index)=><li key={`${item}-${index}`}>{item}</li>)}</ul>
</section> : null;

const auditLabels = {
  job_title_match: 'Target job title', degree_match: 'Degree requirement', word_count: 'Resume length',
  accomplishments: 'Quantified accomplishments', buzz_words: 'Buzzwords', verb_choice: 'Action verbs',
  first_person: 'First-person language', date_formatting: 'Date consistency', general_formatting: 'General formatting',
};

const auditPassed = status => ['MATCH', 'NO_REQUIREMENT', 'OPTIMAL', 'GOOD', 'CLEAN'].includes(status);

const CoverageCard = ({label, coverage}) => <article className="coverage-card">
  <div><h4>{label}</h4><strong>{coverage.coverage_percent}%</strong></div>
  <ScoreBar label={`${coverage.matched} matched · ${coverage.partial} partial · ${coverage.total} total`} score={coverage.coverage_percent}/>
</article>;

const JobAnalysisDashboard = ({analysis}) => {
  if (analysis.legacy_markdown) return <div className="analysis-legacy"><p>This saved result uses the old format. Sync the analysis to generate the dashboard.</p><pre>{analysis.legacy_markdown}</pre></div>;

  const {meta, scores, verdict, radar_chart: radar, skills_breakdown: skills} = analysis;
  const matchedCount = skills.filter(skill => skill.status === 'MATCHED').length;
  const partialCount = skills.filter(skill => skill.status === 'PARTIAL').length;
  const missingCount = skills.filter(skill => skill.status === 'MISSING').length;

  return <div className="analysis-dashboard">
    <section className="analysis-hero">
      <div className="gauge-group"><div><div className="overall-gauge" style={{'--score': scores.overall_match_score}}><div><strong>{scores.overall_match_score}</strong><small>/ 100</small></div></div><small>Job match</small></div>{Number.isInteger(scores.resume_quality_score)&&<div><div className="overall-gauge resume-gauge" style={{'--score': scores.resume_quality_score}}><div><strong>{scores.resume_quality_score}</strong><small>/ 100</small></div></div><small>Resume quality</small></div>}</div>
      <div className="analysis-verdict"><StatusBadge value={verdict.label} kind="verdict"/><h2>{verdict.one_liner}</h2><p>{verdict.summary}</p></div>
      <dl className="analysis-meta"><div><dt>Candidate</dt><dd>{meta.candidate_name || 'Unknown'}</dd></div><div><dt>Role</dt><dd>{meta.job_title}</dd></div><div><dt>Location</dt><dd>{meta.location}</dd></div><div><dt>Seniority</dt><dd>{meta.seniority}</dd></div><div><dt>Confidence</dt><dd>{Math.round(meta.analysis_confidence * 100)}%</dd></div></dl>
    </section>

    <div className="analysis-overview-grid">
      <section className="analysis-panel"><h3>Match scores</h3><div className="score-bars">{Object.entries(scoreLabels).map(([key,label])=><ScoreBar key={key} label={label} score={scores[key]}/>)}</div></section>
      <section className="analysis-panel"><h3>Candidate vs expectation</h3><RadarChart dimensions={radar.dimensions} candidate={radar.candidate} expectation={radar.job_expectation}/></section>
    </div>

    {scores.keyword_coverage_split&&<section className="analysis-panel"><h3>Coverage by category</h3><div className="coverage-grid"><CoverageCard label="Hard skills" coverage={scores.keyword_coverage_split.hard_skills}/><CoverageCard label="Soft skills" coverage={scores.keyword_coverage_split.soft_skills}/><CoverageCard label="Other keywords" coverage={scores.keyword_coverage_split.other_keywords}/></div></section>}

    {analysis.resume_audit&&<section className="analysis-panel"><div className="analysis-section-head"><h3>ATS resume audit</h3><span>{analysis.resume_audit.word_count.count} words</span></div><div className="audit-grid">{Object.entries(auditLabels).map(([key,label])=>{const item=analysis.resume_audit[key];return <article className={`audit-item ${auditPassed(item.status)?'pass':'flag'}`} key={key}><span className="audit-icon">{auditPassed(item.status)?'✓':'!'}</span><div><div><h4>{label}</h4><StatusBadge value={item.status} kind="audit"/></div>{item.feedback&&<p>{item.feedback}</p>}{item.suggestions?.length>0&&<ul>{item.suggestions.map((suggestion,index)=><li key={index}>{suggestion}</li>)}</ul>}</div></article>})}<article className={`audit-item ${analysis.resume_audit.contact_info.has_email&&analysis.resume_audit.contact_info.has_phone?'pass':'flag'}`}><span className="audit-icon">{analysis.resume_audit.contact_info.has_email&&analysis.resume_audit.contact_info.has_phone?'✓':'!'}</span><div><div><h4>Contact information</h4><StatusBadge value={analysis.resume_audit.contact_info.has_email&&analysis.resume_audit.contact_info.has_phone?'CLEAN':'FLAGGED'} kind="audit"/></div><p>{analysis.resume_audit.contact_info.feedback}</p><small>Email: {analysis.resume_audit.contact_info.has_email?'present':'missing'} · Phone: {analysis.resume_audit.contact_info.has_phone?'present':'missing'}</small></div></article></div></section>}

    <section className="analysis-panel"><div className="analysis-section-head"><h3>Skills breakdown</h3><div className="skill-summary"><span className="matched">{matchedCount} matched</span><span className="partial">{partialCount} partial</span><span className="missing">{missingCount} missing</span></div></div><div className="skills-analysis-table-wrap"><table className="skills-analysis-table"><thead><tr><th>Skill</th><th>Category</th><th>Importance</th><th>Status</th><th>Resume evidence</th><th>Gap</th></tr></thead><tbody>{skills.map((skill,index)=><tr key={`${skill.skill}-${index}`}><td><b>{skill.skill}</b></td><td><StatusBadge value={skill.category||'OTHER'} kind="category"/></td><td><StatusBadge value={skill.importance} kind="importance"/></td><td><StatusBadge value={skill.status}/></td><td>{skill.evidence || 'No evidence found'}</td><td><StatusBadge value={skill.gap_severity} kind="severity"/></td></tr>)}</tbody></table></div></section>

    {analysis.experience_timeline?.length > 0 && <section className="analysis-panel"><h3>Relevant experience</h3><div className="experience-timeline">{analysis.experience_timeline.map((item,index)=><article key={`${item.company}-${index}`}><span className="timeline-dot"/><div><div className="timeline-heading"><b>{item.role}</b><StatusBadge value={item.relevance_to_job} kind="relevance"/></div><p>{item.company}</p><small>{item.period} · {item.duration_months} months</small></div></article>)}</div></section>}

    <div className="analysis-card-grid">
      <section className="analysis-panel"><h3>Strengths</h3>{analysis.strengths.map((item,index)=><article className="analysis-callout strength" key={`${item.title}-${index}`}><h4>{item.title}</h4><p>{item.detail}</p><small>{item.evidence}</small></article>)}</section>
      <section className="analysis-panel"><h3>Gaps</h3>{analysis.gaps.map((item,index)=><article className="analysis-callout gap" key={`${item.title}-${index}`}><div><h4>{item.title}</h4><StatusBadge value={item.severity} kind="severity"/></div><p>{item.detail}</p><small><b>Mitigation:</b> {item.mitigation}</small></article>)}</section>
    </div>

    <ListSection title="Deal-breakers" items={analysis.deal_breakers}/>
    <div className="analysis-card-grid"><ListSection title="Resume improvements" items={analysis.resume_improvements}/><ListSection title="Interview preparation" items={analysis.interview_prep}/></div>
    <section className="analysis-panel"><div className="analysis-section-head"><h3>Keyword coverage</h3><strong>{analysis.keyword_coverage.coverage_percent}%</strong></div><ScoreBar label="Coverage" score={analysis.keyword_coverage.coverage_percent}/><div className="keyword-groups"><div><h4>Matched</h4>{analysis.keyword_coverage.matched_keywords.map(keyword=><span className="keyword matched" key={keyword}>{keyword}</span>)}</div><div><h4>Missing</h4>{analysis.keyword_coverage.missing_keywords.map(keyword=><span className="keyword missing" key={keyword}>{keyword}</span>)}</div></div></section>
  </div>;
};

export default JobAnalysisDashboard;
