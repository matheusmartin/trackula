import 'package:jaspr/dom.dart';

/// App styles on top of BeerCSS (Material Design 3). The @css annotation adds them to main.css.
///
/// BeerCSS gives the base look. These rules cover only what BeerCSS has no component for: the habit table
/// and calendars. Colors use the Material theme variables, so they follow the theme and dark mode.
@css
List<StyleRule> get styles => [
  // today.dart
  css('nav.chips, nav.toolbar-row').styles(margin: .only(bottom: 0.75.rem)),
  css('.warnings ul').styles(padding: .only(left: 1.25.rem)),

  // habit_table.dart: shared parts.
  css('.icon').styles(
    display: .flex,
    width: 2.rem,
    height: 2.rem,
    radius: .circular(8.px),
    justifyContent: .center,
    alignItems: .center,
    raw: {
      'flex-shrink': '0',
      'color': 'var(--on-secondary-container)',
      'background-color': 'var(--secondary-container)',
    },
  ),
  css('.icon i').styles(fontSize: 1.25.rem),
  // Day cells. --i is the color strength in percent, set by the table.
  // BeerCSS styles every <button>, so reset its size and padding here.
  css('.cell').styles(
    padding: .zero,
    margin: .zero,
    border: .unset,
    radius: .circular(8.px),
    fontSize: 0.7.rem,
    raw: {
      'inline-size': '2.1rem',
      'block-size': '2.1rem',
      'min-inline-size': '0',
      'color': 'var(--on-surface)',
      'background-color': 'color-mix(in srgb, var(--primary) var(--i), var(--surface-container-highest))',
    },
  ),
  css('.cell.filled').styles(raw: {'color': 'var(--on-primary)'}),
  css('.cell.today').styles(raw: {'box-shadow': 'inset 0 0 0 2px var(--on-surface)'}),
  css('.cell.selected').styles(raw: {'outline': '2px solid var(--tertiary)', 'outline-offset': '1px'}),
  css('.editor').styles(
    display: .flex,
    flexWrap: .wrap,
    alignItems: .center,
    gap: .all(0.5.rem),
  ),
  css('.editor .field').styles(margin: .zero, raw: {'inline-size': '8rem'}),
  css('.editor .field .unit').styles(
    position: .absolute(right: 0.75.rem, top: 50.percent),
    raw: {'transform': 'translateY(-50%)', 'color': 'var(--on-surface-variant)'},
  ),

  // habit_table.dart: 7-day table.
  css('.table-wrap').styles(overflow: .auto),
  css('table.habits', [
    css('&').styles(width: 100.percent, margin: .zero, raw: {'border-collapse': 'collapse'}),
    css('th, td').styles(
      padding: .symmetric(horizontal: 2.px, vertical: 6.px),
      textAlign: .center,
    ),
    css('tbody tr').styles(raw: {'border-top': '1px solid var(--outline-variant)'}),
    css('thead th').styles(fontWeight: .w400, raw: {'line-height': '1.2'}),
    css('thead th small').styles(display: .block, fontSize: 0.75.rem, raw: {'color': 'var(--on-surface-variant)'}),
    css('thead th.today').styles(fontWeight: .w700),
    css('th.name').styles(
      padding: .only(left: 1.rem),
      fontWeight: .w400,
      textAlign: .left,
    ),
    css('th.name > div').styles(display: .flex, alignItems: .center, gap: .all(0.6.rem)),
    css('tr.editor-row td').styles(
      padding: .all(0.75.rem),
      textAlign: .left,
      raw: {'background-color': 'var(--surface-container)'},
    ),
  ]),

  // habit_table.dart: 31-day calendars. As many columns as fit, each at least 15rem wide.
  css('.calendars').styles(
    display: .grid,
    raw: {'grid-template-columns': 'repeat(auto-fill, minmax(15rem, 1fr))', 'gap': '0.75rem'},
  ),
  css('article.calendar', [
    // BeerCSS adds a top margin to each card after the first. In a grid, that breaks the row alignment.
    css('&').styles(raw: {'margin': '0 !important'}),
    css('.calendar-title').styles(
      display: .flex,
      margin: .only(bottom: 0.5.rem),
      alignItems: .center,
      gap: .all(0.6.rem),
    ),
    css('.month').styles(
      display: .grid,
      raw: {'grid-template-columns': 'repeat(7, 1fr)', 'gap': '4px', 'justify-items': 'center'},
    ),
    css('.month small').styles(fontSize: 0.7.rem, raw: {'color': 'var(--on-surface-variant)'}),
    css('.cell').styles(raw: {'inline-size': '1.8rem', 'block-size': '1.8rem'}),
    css('.editor').styles(margin: .only(top: 0.75.rem)),
  ]),

  // trend_chart.dart uses inline styles.

  // Phones: hide the table icons and use smaller cells, so 7 days fit without scrolling.
  css.media(MediaQuery.screen(maxWidth: 480.px), [
    css('table.habits .icon').styles(display: .none),
    css('table.habits .cell').styles(raw: {'inline-size': '1.9rem', 'block-size': '1.9rem'}),
    css('table.habits th.name').styles(padding: .only(left: 0.75.rem)),
  ]),
];
