import React, {useState} from 'react';
import {ArrowDown, ArrowUp, ArrowUpDown} from 'lucide-react';
import Button from '../atoms/Button';
import ScoreBar from '../atoms/ScoreBar';
import StatusBadge from '../atoms/StatusBadge';
import RadarChart, {RadarExplanation} from '../molecules/RadarChart';
import WorkTimeClock from '../molecules/WorkTimeClock';
import WorkLocationMap from '../molecules/WorkLocationMap';
import {getNextSortState} from '../../utils/sortState';
import {sortSkills} from '../../utils/skillSort';
import {filterSkillsByStatus} from '../../utils/skillFilter';
import {getDealBreaker} from '../../utils/dealBreaker';

const scoreLabels = {
  skills_match_score: 'Skills', experience_match_score: 'Experience', seniority_match_score: 'Seniority',
  domain_match_score: 'Domain', culture_soft_skills_score: 'Culture',
};

const ListSection = ({title, items}) => items?.length ? <section className="analysis-panel">
  <h3>{title}</h3><ul className="analysis-list">{items.map((item, index)=><li key={`${item}-${index}`}>{item}</li>)}</ul>
</section> : null;

const DealBreakersSection = ({items}) => items?.length ? <section className="analysis-panel">
  <h3>Deal-breakers</h3>
  <ul className="analysis-list">{items.map((item, index) => {
    const {title, detail, employmentImpossible} = getDealBreaker(item);
    return <li className={employmentImpossible ? 'deal-breaker-danger' : ''} key={`${title}-${index}`}><strong>{title}</strong>{employmentImpossible&&<b className="deal-breaker-danger-label">Employment impossible</b>}{detail&&<span> — {detail}</span>}</li>;
  })}</ul>
</section> : null;

const ConfidenceCard = ({confidence, assessment}) => {
  const percentage = Number.isFinite(confidence) ? Math.round(confidence * 100) : null;
  const missingInformation = assessment?.missing_information || [];

  return <section className="analysis-panel confidence-card">
    <div className="confidence-card-head">
      <div><h3>Analysis confidence</h3><p>How reliable this analysis is based on the available job and candidate information.</p></div>
      <div className="confidence-gauge" style={{'--confidence': percentage || 0}} role="img" aria-label={`Analysis confidence: ${percentage === null ? 'unavailable' : `${percentage}%`}`}>
        <div><strong>{percentage === null ? '—' : percentage}</strong>{percentage !== null&&<small>%</small>}</div>
      </div>
    </div>
    <div className="confidence-missing">
      <h4>Missing information that could improve confidence</h4>
      {missingInformation.length
        ? <ul>{missingInformation.map((item, index) => <li key={`${item.title}-${index}`}><b>{item.title}</b><span>{item.detail}</span></li>)}</ul>
        : <p>{assessment ? 'No important missing information was identified.' : 'Sync the analysis to identify missing information and ways to improve confidence.'}</p>}
    </div>
  </section>;
};

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

const createFallbackClockSchedule = (schedule, season) => ({
  season,
  user_work_start: schedule.user_work_start || schedule.company_work_start,
  user_work_end: schedule.user_work_end || schedule.company_work_end,
  user_work_start_day_offset: schedule.user_work_start_day_offset,
  user_work_end_day_offset: schedule.user_work_end_day_offset,
});

const SkillSortIcon = ({column, sort}) => {
  if (sort.key !== column) return <ArrowUpDown size={13}/>;
  return sort.direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>;
};

const SkillSortHeading = ({column, label, sort, onSort}) => (
  <th aria-sort={sort.key === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <Button className="table-sort-button" onClick={() => onSort(column)} aria-label={`Sort by ${label}`}>
      {label}<SkillSortIcon column={column} sort={sort}/>
    </Button>
  </th>
);

const JobAnalysisDashboard = ({analysis}) => {
  const [skillSort, setSkillSort] = useState({key: null, direction: null});
  const [skillStatusFilter, setSkillStatusFilter] = useState(null);
  if (analysis.legacy_markdown) return <div className="analysis-legacy"><p>This saved result uses the old format. Sync the analysis to generate the dashboard.</p><pre>{analysis.legacy_markdown}</pre></div>;

  const {meta, scores, verdict, radar_chart: radar, skills_breakdown: skills} = analysis;
  const schedule = analysis.work_schedule || {};
  const seasonalSchedules = schedule.seasonal_schedules || [];
  const clockSchedules = ['summer', 'winter'].map(season => (
    seasonalSchedules.find(item => item.season === season)
    || createFallbackClockSchedule(schedule, season)
  ));
  const hasSeasonalTimeChange = seasonalSchedules.some(item => item.has_seasonal_time_change);
  const matchedCount = skills.filter(skill => skill.status === 'MATCHED').length;
  const partialCount = skills.filter(skill => skill.status === 'PARTIAL').length;
  const missingCount = skills.filter(skill => skill.status === 'MISSING').length;
  const filteredSkills = filterSkillsByStatus(skills, skillStatusFilter);
  const sortedSkills = sortSkills(filteredSkills, skillSort);
  const changeSkillSort = key => setSkillSort(current => getNextSortState(current, key));
  const changeSkillStatusFilter = status => setSkillStatusFilter(current => current === status ? null : status);

  return <div className="analysis-dashboard">
    <section className="analysis-hero">
      <div className="gauge-group"><div><div className="overall-gauge" style={{'--score': scores.overall_match_score}}><div><strong>{scores.overall_match_score}</strong><small>/ 100</small></div></div><small>Job match</small></div></div>
      <div className="analysis-verdict"><StatusBadge value={verdict.label} kind="verdict"/></div>
    </section>

    <ConfidenceCard confidence={meta.analysis_confidence} assessment={analysis.confidence_assessment}/>

    <DealBreakersSection items={analysis.deal_breakers}/>

    <section className="analysis-panel match-charts-panel">
      <h3>Match analysis</h3>
      <div className="match-charts-grid">
        <div className="match-chart"><div className="score-bars">{Object.entries(scoreLabels).map(([key,label])=><ScoreBar key={key} label={label} score={scores[key]}/>)}</div></div>
        <div className="match-chart"><RadarChart dimensions={radar.dimensions} candidate={radar.candidate} expectation={radar.job_expectation}/></div>
      </div>
      <RadarExplanation dimensions={radar.dimensions} candidate={radar.candidate} expectation={radar.job_expectation} rationales={radar.rationales}/>
    </section>

    <section className="analysis-panel work-schedule-panel">
      <div className="analysis-section-head"><h3>Working hours & time difference</h3>{Number.isFinite(schedule.schedule_confidence)&&<span>{Math.round(schedule.schedule_confidence*100)}% confidence</span>}</div>
      <div className="seasonal-work-times">
        <div className="seasonal-clock-grid">
          <WorkTimeClock schedules={clockSchedules} workingDays={schedule.company_work_days || []} />
        </div>
        <p className="seasonal-clock-help">
          {schedule.work_hours_basis && <><b>{schedule.work_hours_estimated ? 'Estimated hours: ' : 'Hours source: '}</b>{schedule.work_hours_basis}<br/></>}
          {schedule.work_days_basis && <><b>{schedule.work_days_estimated ? 'Estimated working days: ' : 'Working-days source: '}</b>{schedule.work_days_basis}<br/></>}
          {hasSeasonalTimeChange
            ? 'This company location observes a seasonal clock change. Winter and summer working times are converted to your timezone.'
            : 'This company location uses the same UTC offset in winter and summer, so both clocks show the same converted working time.'}
        </p>
      </div>
    </section>

    <section className="analysis-panel work-location-panel"><h3>Work location</h3><WorkLocationMap meta={meta} schedule={schedule}/></section>

    {scores.keyword_coverage_split&&<section className="analysis-panel"><h3>Coverage by category</h3><div className="coverage-grid"><CoverageCard label="Hard skills" coverage={scores.keyword_coverage_split.hard_skills}/><CoverageCard label="Soft skills" coverage={scores.keyword_coverage_split.soft_skills}/><CoverageCard label="Other keywords" coverage={scores.keyword_coverage_split.other_keywords}/></div></section>}

    {analysis.resume_audit&&<section className="analysis-panel"><div className="analysis-section-head"><h3>ATS resume audit</h3><span>{analysis.resume_audit.word_count.count} words</span></div><div className="audit-grid">{Object.entries(auditLabels).map(([key,label])=>{const item=analysis.resume_audit[key];return <article className={`audit-item ${auditPassed(item.status)?'pass':'flag'}`} key={key}><span className="audit-icon">{auditPassed(item.status)?'✓':'!'}</span><div><div><h4>{label}</h4><StatusBadge value={item.status} kind="audit"/></div>{item.feedback&&<p>{item.feedback}</p>}{item.suggestions?.length>0&&<ul>{item.suggestions.map((suggestion,index)=><li key={index}>{suggestion}</li>)}</ul>}</div></article>})}<article className={`audit-item ${analysis.resume_audit.contact_info.has_email&&analysis.resume_audit.contact_info.has_phone?'pass':'flag'}`}><span className="audit-icon">{analysis.resume_audit.contact_info.has_email&&analysis.resume_audit.contact_info.has_phone?'✓':'!'}</span><div><div><h4>Contact information</h4><StatusBadge value={analysis.resume_audit.contact_info.has_email&&analysis.resume_audit.contact_info.has_phone?'CLEAN':'FLAGGED'} kind="audit"/></div><p>{analysis.resume_audit.contact_info.feedback}</p><small>Email: {analysis.resume_audit.contact_info.has_email?'present':'missing'} · Phone: {analysis.resume_audit.contact_info.has_phone?'present':'missing'}</small></div></article></div></section>}

    <section className="analysis-panel"><div className="analysis-section-head"><h3>Skills breakdown</h3><div className="skill-summary" aria-label="Filter skills by status"><button type="button" className={!skillStatusFilter?'active':''} aria-pressed={!skillStatusFilter} onClick={()=>setSkillStatusFilter(null)}>{skills.length} all</button><button type="button" className={`matched${skillStatusFilter==='MATCHED'?' active':''}`} aria-pressed={skillStatusFilter==='MATCHED'} onClick={()=>changeSkillStatusFilter('MATCHED')}>{matchedCount} matched</button><button type="button" className={`partial${skillStatusFilter==='PARTIAL'?' active':''}`} aria-pressed={skillStatusFilter==='PARTIAL'} onClick={()=>changeSkillStatusFilter('PARTIAL')}>{partialCount} partial</button><button type="button" className={`missing${skillStatusFilter==='MISSING'?' active':''}`} aria-pressed={skillStatusFilter==='MISSING'} onClick={()=>changeSkillStatusFilter('MISSING')}>{missingCount} missing</button></div></div><div className="skills-analysis-table-wrap"><table className="skills-analysis-table"><thead><tr><SkillSortHeading column="skill" label="Skill" sort={skillSort} onSort={changeSkillSort}/><SkillSortHeading column="category" label="Category" sort={skillSort} onSort={changeSkillSort}/><SkillSortHeading column="importance" label="Importance" sort={skillSort} onSort={changeSkillSort}/><SkillSortHeading column="status" label="Status" sort={skillSort} onSort={changeSkillSort}/><SkillSortHeading column="gap" label="Gap" sort={skillSort} onSort={changeSkillSort}/></tr></thead><tbody>{sortedSkills.map((skill,index)=><tr key={`${skill.skill}-${index}`}><td><b>{skill.skill}</b></td><td><StatusBadge value={skill.category||'OTHER'} kind="category"/></td><td><StatusBadge value={skill.importance} kind="importance"/></td><td><StatusBadge value={skill.status}/></td><td><StatusBadge value={skill.gap_severity} kind="severity"/></td></tr>)}{!sortedSkills.length&&<tr><td className="skills-filter-empty" colSpan="5">No skills match this filter.</td></tr>}</tbody></table></div></section>

    <div className="analysis-card-grid">
      <section className="analysis-panel"><h3>Strengths</h3>{analysis.strengths.map((item,index)=><article className="analysis-callout strength" key={`${item.title}-${index}`}><h4>{item.title}</h4><p>{item.detail}</p><small>{item.evidence}</small></article>)}</section>
      <section className="analysis-panel"><h3>Gaps</h3>{analysis.gaps.map((item,index)=><article className="analysis-callout gap" key={`${item.title}-${index}`}><div><h4>{item.title}</h4><StatusBadge value={item.severity} kind="severity"/></div><p>{item.detail}</p><small><b>Mitigation:</b> {item.mitigation}</small></article>)}</section>
    </div>

    <div className="analysis-card-grid"><ListSection title="Resume improvements" items={analysis.resume_improvements}/><ListSection title="Interview preparation" items={analysis.interview_prep}/></div>
    <section className="analysis-panel"><div className="analysis-section-head"><h3>Keyword coverage</h3><strong>{analysis.keyword_coverage.coverage_percent}%</strong></div><ScoreBar label="Coverage" score={analysis.keyword_coverage.coverage_percent}/><div className="keyword-groups"><div><h4>Matched</h4>{analysis.keyword_coverage.matched_keywords.map(keyword=><span className="keyword matched" key={keyword}>{keyword}</span>)}</div><div><h4>Missing</h4>{analysis.keyword_coverage.missing_keywords.map(keyword=><span className="keyword missing" key={keyword}>{keyword}</span>)}</div></div></section>
  </div>;
};

export default JobAnalysisDashboard;
