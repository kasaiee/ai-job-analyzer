import React from 'react';

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_CLOCK = 12 * 60;
const CLOCK_CENTER = 100;
const TICK_OUTER_RADIUS = 91;
const TICK_INNER_RADIUS = 85;
const HOUR_LABEL_RADIUS = 69;
const CLOCK_LABELS = Array.from({length: 12}, (_, index) => index + 1);
const SEASON_CONFIG = {
  summer: {label: 'Summer', radius: 56},
  winter: {label: 'Winter', radius: 43},
};
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const timeToMinutes = time => {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return null;

  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatDayOffset = dayOffset => {
  if (dayOffset === 1) return ' · next day';
  if (dayOffset === -1) return ' · previous day';
  return '';
};

const formatUtcOffset = offsetMinutes => {
  if (!Number.isFinite(offsetMinutes)) return null;

  const sign = offsetMinutes >= 0 ? '+' : '−';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
  const minutes = String(absoluteMinutes % 60).padStart(2, '0');

  return `UTC${sign}${hours}:${minutes}`;
};

const pointOnClock = (minutes, radius) => {
  const clockMinutes = minutes % MINUTES_PER_CLOCK;
  const angle = clockMinutes / MINUTES_PER_CLOCK * Math.PI * 2 - Math.PI / 2;

  return {
    x: CLOCK_CENTER + radius * Math.cos(angle),
    y: CLOCK_CENTER + radius * Math.sin(angle),
  };
};

const createRangeArc = (startMinutes, clockDuration, radius) => {
  if (clockDuration <= 0) return '';

  const start = pointOnClock(startMinutes, radius);
  const end = pointOnClock(startMinutes + clockDuration, radius);
  const largeArcFlag = clockDuration > MINUTES_PER_CLOCK / 2 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

const createClockRange = schedule => {
  const config = SEASON_CONFIG[schedule.season];
  const startMinutes = timeToMinutes(schedule.user_work_start);
  const endMinutes = timeToMinutes(schedule.user_work_end);
  const hasTimeRange = startMinutes !== null && endMinutes !== null;
  const duration = hasTimeRange
    ? (endMinutes - startMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY
    : 0;
  const timezoneLabel = [
    schedule.company_timezone_name,
    formatUtcOffset(schedule.company_utc_offset_minutes),
  ].filter(Boolean).join(' · ');

  return {
    ...config,
    season: schedule.season,
    hasTimeRange,
    timezoneLabel,
    rangeLabel: hasTimeRange
      ? `${schedule.user_work_start}${formatDayOffset(schedule.user_work_start_day_offset)} – ${schedule.user_work_end}${formatDayOffset(schedule.user_work_end_day_offset)}`
      : 'Working hours unavailable',
    startLabel: startMinutes !== null
      ? `${schedule.user_work_start}${formatDayOffset(schedule.user_work_start_day_offset)}`
      : 'Unavailable',
    endLabel: endMinutes !== null
      ? `${schedule.user_work_end}${formatDayOffset(schedule.user_work_end_day_offset)}`
      : 'Unavailable',
    arc: hasTimeRange
      ? createRangeArc(startMinutes, Math.min(duration, MINUTES_PER_CLOCK - 1), config.radius)
      : '',
    startPoint: hasTimeRange ? pointOnClock(startMinutes, config.radius) : null,
    endPoint: hasTimeRange ? pointOnClock(endMinutes, config.radius) : null,
  };
};

/** Displays summer and winter work-time ranges together on one 12-hour clock. */
const WorkTimeClock = ({schedules, workingDays = []}) => {
  const ranges = schedules.map(createClockRange);
  const displayedWorkingDays = WEEKDAYS.filter(weekday => workingDays.includes(weekday));
  const rangesBySeason = Object.fromEntries(
    ranges.map(range => [range.season, range]),
  );
  const accessibleRanges = ranges
    .map(range => `${range.label}: ${range.rangeLabel}`)
    .join('; ');

  return <div className="work-time-clock combined-seasons">
    <div
      className="clock-face analog-clock"
      role="img"
      aria-label={`Seasonal local working hours. ${accessibleRanges}`}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="analog-clock-face" cx="100" cy="100" r="96" />
        <circle className="analog-clock-inner" cx="100" cy="100" r="91" />
        {Array.from({length: 12}, (_, hour) => {
          const outer = pointOnClock(hour * 60, TICK_OUTER_RADIUS);
          const inner = pointOnClock(hour * 60, TICK_INNER_RADIUS);

          return <line
            className="clock-tick major"
            key={hour}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
          />;
        })}
        {CLOCK_LABELS.map(hour => {
          const position = pointOnClock(hour * 60, HOUR_LABEL_RADIUS);

          return <text className="clock-number" key={hour} x={position.x} y={position.y}>
            {hour}
          </text>;
        })}
        {ranges.map(range => range.hasTimeRange && <g className={`season-range ${range.season}`} key={range.season}>
          <path className="work-range-arc" d={range.arc} />
          <circle className="range-handle" cx={range.startPoint.x} cy={range.startPoint.y} r="4" />
          <circle className="range-handle" cx={range.endPoint.x} cy={range.endPoint.y} r="4" />
        </g>)}
        <circle className="clock-pin-inner" cx="100" cy="100" r="3" />
      </svg>
    </div>
    <div className="weekday-table-wrap">
      <table className="weekday-work-table">
        <caption>Working hours by weekday</caption>
        <thead>
          <tr>
            <th scope="col" rowSpan="2">Working day</th>
            {['summer', 'winter'].map(season => {
              const range = rangesBySeason[season];

              return <th className={season} scope="colgroup" colSpan="2" key={season}>
                <span><i aria-hidden="true" /> {range.label}</span>
                {range.timezoneLabel && <small>{range.timezoneLabel}</small>}
              </th>;
            })}
          </tr>
          <tr>
            <th className="summer" scope="col">Start</th>
            <th className="summer" scope="col">End</th>
            <th className="winter" scope="col">Start</th>
            <th className="winter" scope="col">End</th>
          </tr>
        </thead>
        <tbody>
          {displayedWorkingDays.map(weekday => <tr className="working-day" key={weekday}>
            <th scope="row">{weekday}</th>
            <td className="summer">{rangesBySeason.summer.startLabel}</td>
            <td className="summer">{rangesBySeason.summer.endLabel}</td>
            <td className="winter">{rangesBySeason.winter.startLabel}</td>
            <td className="winter">{rangesBySeason.winter.endLabel}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
};

export default WorkTimeClock;
