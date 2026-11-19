import { addMonths, daysOfMonth, monthOf, sameMonth } from '../../model/Day.js';
import { formatNumber, monthTitle, shortDay, weekdayNames } from '../../model/Format.js';
import { AppIconButton } from './AppIconButton.jsx';
import { MAX_FILL, cellFill } from './CompareCharts.jsx';
import './Charts.css';
import './ScoreCalendar.css';

/** @import { JSX } from 'preact' */
/** @import { Day, MonthKey } from '../../model/Day.js' */

/**
 * The score of each day of one `month`: a read-only month calendar with the score of each day, Monday first. A day
 * with a higher score has a darker color: a score of 100 has the most color. A day without a score has the empty color
 * and no number. `today` has a ring. `onMonth` is called when the arrows change the month. The arrow to the next month
 * stops at the month of `today`. Each day has a tooltip and a name for screen readers with its score.
 * @param {object} props
 * @param {Map<Day, number>} props.scores
 * @param {Day} props.today
 * @param {MonthKey} props.month
 * @param {(month: MonthKey) => void} props.onMonth
 * @returns {JSX.Element}
 */
export function ScoreCalendar({ scores, today, month, onMonth }) {
  const days = daysOfMonth(month);
  // Empty cells before the first day, so that each column is one weekday.
  const cells = [.../** @type {(Day | null)[]} */ (Array(days[0].weekday - 1).fill(null)), ...days];
  /** @type {(Day | null)[][]} */
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <section class="score-calendar">
      <h3 class="score-calendar-heading title-medium">Score by month</h3>
      <div class="score-calendar-bar">
        <AppIconButton icon="chevron_left" title="Previous month" onClick={() => onMonth(addMonths(month, -1))} />
        <span class="score-calendar-title title-small">{monthTitle(month)}</span>
        <AppIconButton
          icon="chevron_right"
          title="Next month"
          onClick={() => onMonth(addMonths(month, 1))}
          enabled={!sameMonth(month, monthOf(today))}
        />
      </div>
      <div class="score-calendar-grid">
        <table class="score-calendar-days">
          <thead>
            <tr>
              {weekdayNames.map((name) => (
                <th key={name} scope="col" class="score-calendar-weekday chart-label">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.find((d) => d != null)?.toString()}>
                {Array.from({ length: 7 }, (_, i) => week[i] ?? null).map((d, i) => {
                  if (d == null) return <td key={i} class="score-calendar-cell" />;
                  const score = scores.get(d) ?? null;
                  const text = `${shortDay(d)}: ${score == null ? 'no score' : formatNumber(score)}`;
                  const classes = ['score-calendar-day', 'chart-ink'];
                  if (score == null) classes.push('score-calendar-empty');
                  if (d === today) classes.push('score-calendar-today');
                  return (
                    <td key={i} class="score-calendar-cell" aria-label={text} title={text}>
                      <div
                        class={classes.join(' ')}
                        style={{
                          '--fill':
                            score == null ? 'var(--cell-empty)' : cellFill('var(--cell)', (MAX_FILL * score) / 100),
                        }}
                        aria-hidden="true"
                      >
                        <span class="score-calendar-date">{d.day}</span>
                        {score != null && <span class="score-calendar-score">{formatNumber(score)}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
