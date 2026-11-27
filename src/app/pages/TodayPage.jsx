import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CountQueue } from '../../model/CountQueue.js';
import { daysBetween } from '../../model/Day.js';
import { formatNumber } from '../../model/Format.js';
import { CALENDAR_DAYS, DayLayout, MainView, dayLayoutOf } from '../../model/MainView.js';
import { NumberMetric, groupOf, metricsOf } from '../../model/Metric.js';
import { Route, Screen } from '../../model/Route.js';
import { dayScores, pointsByMetric, pointsOf } from '../../model/Score.js';
import { errorText } from '../Errors.js';
import { useNavigator, useRoute } from '../Navigation.js';
import { useElementWidth } from '../components/ElementWidth.js';
import { GroupChips, groupLabel } from '../components/GroupChips.jsx';
import { HabitTable, tableDays } from '../components/HabitTable.jsx';
import { Notice, NoticeKind } from '../components/Notice.jsx';
import { ScoreChart } from '../components/ScoreChart.jsx';
import { SegmentedButtons } from '../components/SegmentedButtons.jsx';
import { Symbol } from '../components/Symbol.jsx';
import { TodayTiles } from '../components/TodayTiles.jsx';
import { TrendChart } from '../components/TrendChart.jsx';
import { MetricDetail } from './MetricDetail.jsx';
import { MetricsPage } from './MetricsPage.jsx';
import { ScorePage } from './ScorePage.jsx';
import './TodayPage.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, LogWrite } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */
/** @import { MetricsTable } from '../../model/MetricsTable.js' */
/** @import { MetricsWrite } from '../../model/MetricsWrite.js' */
/** @import { LogPlan, Snapshot, Store } from '../../sheets/Store.js' */

/** The reload button in the app bar calls `run`. The Today page sets it. */
export class ReloadHandle {
  constructor() {
    /** @type {(() => void) | null} */
    this.run = null;
  }
}

/**
 * The state of the page that the store calls read and change at once, also before the next render.
 * @typedef {object} PageState
 * @property {Snapshot | null} data The data of the last load or write.
 * @property {boolean} busy True while a load or a write runs.
 * @property {boolean} alive False after the page is gone, for example after a sign-out.
 */

/**
 * The main page: the metrics in Today tiles, a table or calendars, where the user records entries, or the score only.
 * The screen comes from the address (see `Route`): a view of the navigation, the detail screen of a metric, or the
 * metrics screen and its forms. The page needs the `Navigator` of the App in `LocalNavigator`.
 *
 * The page writes one change at a time. Count taps queue while a write runs, show at once, and go to the sheet in one
 * write for each cell when the write ends. See `CountQueue`.
 * @param {object} props
 * @param {Store} props.store The store of the sheet, or of demo mode. The page keeps the first one.
 * @param {Day} props.today
 * @param {() => boolean} props.expired True after the Google sign-in expired. Then `onExpired` runs instead of a store
 *   call.
 * @param {() => void} props.onExpired
 * @param {ReloadHandle} props.reload The reload button in the app bar calls it. The page sets it.
 * @param {(busy: boolean) => void} props.onBusy Called when a load or a write starts and ends. The app bar shows a
 *   progress circle while it is true.
 * @param {(key: string) => string | null} props.readPref
 * @param {(key: string, value: string | null) => void} props.writePref The group filter stays in local storage. The
 *   filter also selects the score: of all metrics, or of the metrics of the selected group.
 * @param {boolean} [props.hasMouse] True if the device has a mouse. Then a drag moves a metric on the metrics screen,
 *   not arrow buttons.
 * @returns {JSX.Element}
 */
export function TodayPage({
  store: firstStore,
  today,
  expired,
  onExpired,
  reload,
  onBusy,
  readPref,
  writePref,
  hasMouse = false,
}) {
  const [store] = useState(() => firstStore);
  const navigator = useNavigator();
  const route = useRoute(navigator);
  // The latest callbacks: the reload handle and the store calls keep one function for the life of the page.
  const latest = useRef({ expired, onExpired, onBusy });
  latest.current = { expired, onExpired, onBusy };
  const page = useRef(/** @type {PageState} */ ({ data: null, busy: false, alive: true })).current;
  const [data, setData] = useState(/** @type {Snapshot | null} */ (null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  // The view of the navigation. The other screens show on top of it.
  const view = route.view ?? MainView.TODAY;
  // The id of the metric with the open detail screen. Null shows the view.
  const detailId = route.screen === Screen.METRIC ? route.param : null;
  const managing = route.isMetrics;
  // The selected group, or null for all groups.
  const [group, setGroup] = useState(() => readPref('group'));
  // The layout of the Days view. It stays in local storage, as the group.
  const [dayLayout, setDayLayout] = useState(() => dayLayoutOf(readPref('days-layout')));
  // The width of the Days view: the table shows as many days as it holds.
  const [measureDays, daysWidth] = useElementWidth();
  // The count taps that are not in the sheet yet. The table shows them at once. The queue is not a state, so `counts`
  // changes after each change of the queue, to show the new taps.
  const queue = useMemo(() => new CountQueue(), []);
  const [counts, setCounts] = useState(0);

  /**
   * Runs `task` and shows its data. `done` runs in the same update as the new data or the error. After that, the count
   * taps that came during the task get written.
   * @param {() => Promise<Snapshot>} task
   * @param {(() => void) | null} [done]
   * @returns {Promise<void> | null} The end of the task. Null if the sign-in expired: then the task does not run.
   */
  function run(task, done = null) {
    if (latest.current.expired()) {
      latest.current.onExpired();
      return null;
    }
    page.busy = true;
    setBusy(true);
    setError(null);
    latest.current.onBusy(true);
    return (async () => {
      try {
        const snapshot = await task();
        page.data = snapshot;
        setData(snapshot);
      } catch (e) {
        setError(errorText(e));
      } finally {
        // Also after an error, so that the taps of a failed write are not written again.
        page.busy = false;
        setBusy(false);
        done?.();
        setCounts((n) => n + 1);
        latest.current.onBusy(false);
        // The page is gone, for example after a sign-out: no new write.
        if (page.alive) writeCounts();
      }
    })();
  }

  /**
   * Writes the queued count taps: one write for each cell, with all taps of that cell. See CountQueue. One write at a
   * time: it waits while another load or write runs. If a write fails, its taps are dropped and the error shows.
   */
  function writeCounts() {
    if (page.busy || !queue.hasQueued) return;
    const plans = queue.send(new Map((page.data?.metrics ?? []).map((m) => [m.id, m])));
    setCounts((n) => n + 1);
    run(
      () => store.changeAll(plans),
      () => queue.sent(),
    );
  }

  /** @param {(log: LogTable) => LogWrite | null} plan */
  function write(plan) {
    run(() => store.change(plan));
  }

  /**
   * Saves the values of the Today tiles. After a successful save, the page shows the Days view. The app still opens on
   * the Today tiles. After an error, the Today tiles stay.
   * @param {LogPlan[]} plans
   * @param {() => void} onDone
   */
  function writeAll(plans, onDone) {
    // True after the save. Not the error state: a write of queued count taps can start and clear the error.
    let saved = false;
    const job = run(async () => {
      const snapshot = await store.changeAll(plans);
      saved = true;
      return snapshot;
    }, onDone);
    if (job == null) {
      onDone();
      return;
    }
    void job.then(() => {
      if (saved) navigator.show(Route.DAYS);
    });
  }

  /**
   * Writes a change to the Metrics tab. `onDone` runs after a write without an error, for example to close the form.
   * @param {(table: MetricsTable) => MetricsWrite[]} plan
   * @param {() => void} onDone
   */
  function writeMetrics(plan, onDone) {
    let saved = false;
    const job = run(async () => {
      const snapshot = await store.changeMetrics(plan);
      saved = true;
      return snapshot;
    });
    void job?.then(() => {
      if (saved) onDone();
    });
  }

  /**
   * Adds a count tap. The table shows it at once. The write starts when no other write runs.
   * @param {NumberMetric} m
   * @param {Day} d
   * @param {CountStep} step
   */
  function count(m, d, step) {
    queue.add(m.id, d, step);
    setCounts((n) => n + 1);
    writeCounts();
  }

  // The functions of the latest render, for the reload handle.
  const actions = useRef({ run });
  actions.current = { run };

  useEffect(() => {
    page.alive = true;
    actions.current.run(async () => {
      await store.refreshRules();
      return store.load();
    });
    return () => {
      page.alive = false;
    };
  }, []);

  useEffect(() => {
    const handle = () => void actions.current.run(() => store.load());
    reload.run = handle;
    // A new page (another sheet) can already use the handle.
    return () => {
      if (reload.run === handle) reload.run = null;
    };
  }, [reload]);

  const pending = useMemo(() => queue.pending, [queue, counts]);
  const metrics = data?.metrics ?? NO_METRICS;
  const groups = useMemo(() => [...new Set(metrics.map(groupOf))], [metrics]);
  const selectedGroup = group != null && groups.includes(group) ? group : null;
  const shown = useMemo(() => metricsOf(metrics, selectedGroup), [metrics, selectedGroup]);

  // The points of the metrics that the group filter shows, and their scores. They change only with the data, the taps,
  // the day and the filter.
  const points = useMemo(
    () =>
      data == null ? new Map() : pointsOf(metrics, selectedGroup, pointsByMetric(metrics, data.log, today, pending)),
    [data, today, pending, selectedGroup],
  );
  const scores = useMemo(() => dayScores(points), [points]);
  const scoreTitle = selectedGroup == null ? 'Score' : `Score · ${groupLabel(selectedGroup)}`;

  /** @param {Metric} m */
  function openDetail(m) {
    navigator.go(Route.metric(m.id));
  }

  function closeDetail() {
    navigator.back();
  }

  // The detail screen of one metric. If the metric is gone from the sheet, the screen before shows again.
  const detailMetric = metrics.find((m) => m.id === detailId) ?? null;
  useEffect(() => {
    if (detailId != null && data != null && detailMetric == null && navigator.route.equals(route)) closeDetail();
  }, [detailId, detailMetric == null, data == null]);

  if (managing && data != null) {
    return <MetricsPage data={data} busy={busy} error={error} hasMouse={hasMouse} onWrite={writeMetrics} />;
  }

  if (data != null && detailMetric != null) {
    return (
      <div class="today-page">
        {error != null && <Notice text={error} kind={NoticeKind.ERROR} />}
        <MetricDetail
          key={detailMetric.id}
          metric={detailMetric}
          log={data.log}
          today={today}
          busy={busy}
          onWrite={write}
          pending={pending}
          onCount={count}
          onBack={closeDetail}
        />
      </div>
    );
  }

  /**
   * The content of the view: the tiles, the table, the calendars or the score.
   * @param {Snapshot} snapshot
   * @returns {JSX.Element}
   */
  function viewContent(snapshot) {
    if (view === MainView.TODAY) {
      return (
        <TodayTiles
          metrics={shown}
          log={snapshot.log}
          today={today}
          busy={busy}
          onWriteAll={writeAll}
          pending={pending}
        />
      );
    }
    if (view === MainView.SCORE) {
      return (
        <ScorePage
          key={selectedGroup ?? ''}
          title={scoreTitle}
          scores={scores}
          today={today}
          metrics={shown}
          points={points}
        />
      );
    }
    const dayCount = dayLayout === DayLayout.CALENDARS ? CALENDAR_DAYS : tableDays(daysWidth);
    const days = daysBetween(today.addDays(1 - dayCount), today);
    return (
      <>
        <SegmentedButtons
          label="Layout of the days"
          segments={DAY_LAYOUTS}
          selected={dayLayout}
          onSelect={(value) => {
            const layout = dayLayoutOf(value);
            setDayLayout(layout);
            writePref('days-layout', layout);
          }}
        />
        <ScoreChart title={scoreTitle} days={days} scores={scores} onOpen={() => navigator.show(Route.SCORE)} />
        <HabitTable
          metrics={shown}
          log={snapshot.log}
          today={today}
          days={days}
          layout={dayLayout}
          busy={busy}
          onWrite={write}
          pending={pending}
          onCount={count}
          onOpen={openDetail}
          // Number metrics also get a line chart of the same days.
          calendarExtra={(m, values) =>
            m instanceof NumberMetric ? (
              <TrendChart days={days} values={values} unit={m.unit} showsBars={m.isCount} />
            ) : null
          }
        />
      </>
    );
  }

  return (
    <div class="today-page">
      {/* One line for all problems of the sheet. Show opens the metrics screen, which lists them. */}
      {data != null && data.warnings.length > 0 && (
        <Notice
          text={problemsText(data.warnings.length)}
          kind={NoticeKind.WARNING}
          action="Show"
          onAction={() => navigator.go(Route.METRICS)}
        />
      )}
      {groups.length > 1 && (
        <GroupChips
          groups={groups}
          selected={selectedGroup}
          onSelect={(g) => {
            setGroup(g);
            writePref('group', g);
          }}
        />
      )}
      {/* Above the content, so that the error of a save shows next to the top of the page. Try again loads the sheet. */}
      {error != null && (
        <Notice text={error} kind={NoticeKind.ERROR} action="Try again" onAction={() => run(() => store.load())} />
      )}
      {data == null && error == null && <Loading />}
      {data != null && metrics.length === 0 && <NoMetrics onAdd={() => navigator.go(Route.METRICS)} />}
      {data != null && metrics.length > 0 && (
        // A short fade between the views of the navigation. The table of the Days view is not wider than 720 px: on a
        // wide screen, the cells stay near the names, and it holds 14 days.
        <div
          key={view.name}
          ref={view === MainView.DAYS ? measureDays : undefined}
          class={
            view === MainView.DAYS && dayLayout === DayLayout.TABLE
              ? 'today-page-view today-page-table'
              : 'today-page-view'
          }
        >
          {viewContent(data)}
        </div>
      )}
    </div>
  );
}

/** The metrics before the first load. */
const NO_METRICS = /** @type {Metric[]} */ ([]);

/** The choices of the layout switch of the Days view. */
const DAY_LAYOUTS = [
  { value: DayLayout.TABLE, label: 'Table', icon: 'table_rows' },
  { value: DayLayout.CALENDARS, label: 'Calendars', icon: 'calendar_month' },
];

/**
 * The first load of the sheet: a progress circle in the page. The app bar also shows a small one.
 * @returns {JSX.Element}
 */
function Loading() {
  return (
    <div class="today-page-loading">
      <progress class="circle" aria-hidden="true" />
      <p class="today-page-quiet">Loading your data…</p>
    </div>
  );
}

/**
 * A sheet without metrics: what the app needs, and the button that opens the metrics screen.
 * @param {object} props
 * @param {() => void} props.onAdd
 * @returns {JSX.Element}
 */
function NoMetrics({ onAdd }) {
  return (
    <div class="today-page-empty">
      <Symbol name="tune" size={40} color="var(--on-surface-variant)" />
      <h2 class="today-page-empty-title title-large">No metrics yet</h2>
      <p class="today-page-empty-text today-page-quiet">
        A metric is a thing that you record each day, for example your weight or a habit.
      </p>
      <button type="button" class="today-page-button label-large" onClick={onAdd}>
        Add a metric
      </button>
    </div>
  );
}

/**
 * The text of the line of the sheet problems. Examples: "1 problem in the sheet.", "3 problems in the sheet."
 * @param {number} count
 * @returns {string}
 */
function problemsText(count) {
  return `${formatNumber(count)} ${count === 1 ? 'problem' : 'problems'} in the sheet.`;
}
