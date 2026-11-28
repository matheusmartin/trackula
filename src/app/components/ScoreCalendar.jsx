import { ScoreCell } from './DayCell.jsx';
import { CellLegend } from './HabitTable.jsx';
import { MonthsCard } from './MonthCalendar.jsx';

/** @import { JSX } from 'preact' */
/** @import { Day, MonthKey } from '../../model/Day.js' */

/**
 * The Days card of the Score screen: the score of each day in month calendars, read-only. A cell has the same fill as
 * a day cell of a metric, from the score of the day: 100 is the full gradient. A day without a score has only a
 * border. Each cell shows its day number and its score, and has a tooltip. See `MonthsCard` for the months and the
 * arrows.
 * @param {object} props
 * @param {Map<Day, number>} props.scores
 * @param {Day} props.today
 * @param {MonthKey} props.month The last month in view.
 * @param {(month: MonthKey) => void} props.onMonth
 * @returns {JSX.Element}
 */
export function ScoreCalendar({ scores, today, month, onMonth }) {
  return (
    <MonthsCard
      title="Days"
      description="The score of each day, in % of the points. The color shows the score."
      today={today}
      month={month}
      onMonth={onMonth}
      cell={(d) => <ScoreCell day={d} today={today} score={scores.get(d) ?? null} showsDay />}
    >
      <CellLegend labels={['No score', '0%', 'Some', '100%']} />
    </MonthsCard>
  );
}
