import 'package:jaspr/dom.dart';

/// App styles on top of BeerCSS (Material Design 3). The @css annotation adds them to main.css.
///
/// BeerCSS gives the base look. These rules cover only what BeerCSS has no component for: the habit table
/// and calendars. Colors use the Material theme variables, so they follow the theme and dark mode.
@css
List<StyleRule> get styles => [
  // today.dart
  css('nav.chips').styles(margin: .only(bottom: 0.75.rem)),
  // header.dart: the progress circle in the app bar, white as the icons. BeerCSS draws it in the primary color.
  css('header progress.circle').styles(raw: {'color': 'var(--on-primary)'}),
  // Group chips: one row that scrolls sideways, without a scroll bar. The right edge fades out to show more chips.
  css('nav.chips', [
    css('&').styles(
      padding: .symmetric(vertical: 2.px),
      flexWrap: .nowrap,
      gap: .all(0.5.rem),
      raw: {
        'overflow-x': 'auto',
        'scrollbar-width': 'none',
        'mask-image': 'linear-gradient(to right, #000 calc(100% - 1.5rem), transparent)',
      },
    ),
    css('&::-webkit-scrollbar').styles(display: .none),
    css('.chip').styles(
      margin: .zero,
      raw: {
        'flex-shrink': '0',
        'color': 'var(--on-surface)',
        'border-color': 'color-mix(in srgb, var(--primary) 30%, var(--outline-variant))',
      },
    ),
    css('.chip.selected').styles(
      raw: {'color': 'var(--on-primary)', 'background-color': 'var(--primary)', 'border-color': 'var(--primary)'},
    ),
    // Space at the end, so the last chip can scroll out of the faded edge.
    css('&::after').styles(raw: {'content': '""', 'flex': '0 0 1rem'}),
  ]),
  css('.warnings ul').styles(padding: .only(left: 1.25.rem)),

  // habit_table.dart: shared parts.
  css('.icon').styles(
    display: .flex,
    width: 2.rem,
    height: 2.rem,
    radius: .circular(8.px),
    justifyContent: .center,
    alignItems: .center,
    // White chip with a red icon: emojis keep their own colors, and Material Symbols have a contrast of 6:1.
    // The thin border keeps the chip visible on the card.
    raw: {
      'flex-shrink': '0',
      'box-sizing': 'border-box',
      'color': 'var(--primary)',
      'background-color': 'var(--surface-container-lowest)',
      'border': '1px solid color-mix(in srgb, var(--primary) 12%, var(--outline-variant))',
    },
  ),
  css('.icon i').styles(fontSize: 1.25.rem),
  // The title of the detail screen: a larger chip.
  css('.icon.large').styles(width: 2.75.rem, height: 2.75.rem, fontSize: 1.5.rem, radius: .circular(10.px)),
  css('.icon.large i').styles(fontSize: 1.75.rem),
  // Day cells. Empty cells use the strongest container color. Cells with a value use one fixed color.
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
      // Count cells use double-taps: no double-tap zoom, no text selection, no iOS callout.
      'touch-action': 'manipulation',
      'user-select': 'none',
      '-webkit-user-select': 'none',
      '-webkit-touch-callout': 'none',
      'color': 'var(--on-surface)',
      'background-color': 'var(--surface-container-highest)',
    },
  ),
  // 70% primary: softer than the full primary. White text still has a contrast of 4:1, and the cell 3:1 to empty cells.
  css('.cell.filled').styles(
    raw: {
      'color': 'var(--on-primary)',
      'background-color': 'color-mix(in srgb, var(--primary) 70%, var(--surface-container-highest))',
    },
  ),
  // Today: a soft ring, 40% of the text color. It shows on empty and on filled cells.
  css('.cell.today').styles(
    raw: {'box-shadow': 'inset 0 0 0 2px color-mix(in srgb, var(--on-surface) 40%, transparent)'},
  ),
  css('.cell.selected').styles(raw: {'outline': '2px solid var(--tertiary)', 'outline-offset': '1px'}),
  // Days after today: shown in full months, but faded and not editable.
  css('.cell.future').styles(
    raw: {
      'background-color': 'color-mix(in srgb, var(--surface-container-highest) 40%, transparent)',
      'cursor': 'default',
    },
  ),
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

  // number_editor.dart: value field, ruler and buttons. One ruler tick is 9px, as _tick in number_editor.dart.
  css('.number-editor', [
    css('&').styles(flexDirection: .column, alignItems: .stretch),
    css('.value').styles(
      display: .flex,
      justifyContent: .center,
      alignItems: .baseline,
      gap: .all(0.25.rem),
    ),
    css('.value input').styles(
      padding: .zero,
      textAlign: .center,
      fontSize: 1.75.rem,
      fontWeight: .w500,
      // No frame: no border, and no BeerCSS input radius. The text cursor shows when the field is in use.
      raw: {
        'inline-size': '7ch',
        'border': '0',
        'border-radius': '0',
        'background': 'transparent',
        'color': 'var(--on-surface)',
        'outline': 'none',
      },
    ),
    css('.value .unit').styles(raw: {'color': 'var(--on-surface-variant)'}),
    css('.ruler').styles(
      position: .relative(),
      radius: .circular(8.px),
      overflow: .hidden,
      cursor: .ewResize,
      raw: {
        'block-size': '3.25rem',
        'background-color': 'var(--surface-container-lowest)',
        'border': '1px solid color-mix(in srgb, var(--primary) 12%, var(--outline-variant))',
        'touch-action': 'pan-y',
        'user-select': 'none',
        '-webkit-user-select': 'none',
      },
    ),
    css('.ruler:focus-visible').styles(raw: {'outline': '2px solid var(--primary)', 'outline-offset': '2px'}),
    css('.strip').styles(
      display: .flex,
      position: .absolute(left: 50.percent, top: .zero),
      raw: {'block-size': '100%'},
    ),
    css('.tick').styles(position: .relative(), raw: {'flex': '0 0 9px'}),
    css('.tick::before').styles(
      position: .absolute(left: 4.px, top: .zero),
      raw: {
        'content': '""',
        'inline-size': '1px',
        'block-size': '0.625rem',
        'background-color': 'color-mix(in srgb, var(--on-surface) 25%, transparent)',
      },
    ),
    css('.tick.mid::before').styles(raw: {'block-size': '1rem'}),
    css('.tick.major::before').styles(raw: {'block-size': '1.5rem', 'background-color': 'var(--on-surface-variant)'}),
    // The start value: a green tick over the full height, 2px wide as the needle. Left 3.5px: centered on the 1px
    // tick line at 4px. Green: --done in web/theme.css.
    css('.tick.start::before').styles(
      position: .absolute(left: 3.5.px, top: .zero),
      raw: {'inline-size': '2px', 'block-size': '100%', 'background-color': 'var(--done)'},
    ),
    css('.tick span').styles(
      position: .absolute(left: 4.5.px, top: 1.75.rem),
      fontSize: 0.7.rem,
      raw: {'transform': 'translateX(-50%)', 'white-space': 'nowrap', 'color': 'var(--on-surface-variant)'},
    ),
    css('.needle').styles(
      position: .absolute(left: 50.percent, top: .zero, bottom: .zero),
      raw: {'inline-size': '2px', 'margin-left': '-1px', 'background-color': 'var(--primary)'},
    ),
    css('.actions').styles(display: .flex, flexWrap: .wrap, alignItems: .center, gap: .all(0.5.rem)),
  ]),

  // today_tiles.dart: one tile for each metric. Phones: 2 columns. Wider screens: 4 columns. Number tiles with a
  // ruler take a full row, so that the small tiles in a row have the same height. Dense: small tiles fill the gaps.
  // Green: --done variables in web/theme.css.
  css('.tiles', [
    css('&').styles(
      display: .grid,
      raw: {'grid-template-columns': 'repeat(2, minmax(0, 1fr))', 'grid-auto-flow': 'row dense', 'gap': '0.75rem'},
    ),
    css('.tile').styles(
      position: .relative(),
      radius: .circular(16.px),
      raw: {'background-color': 'var(--surface-container)', 'min-width': '0'},
    ),
    css('.tile.done').styles(
      raw: {'background-color': 'var(--done-container)', 'color': 'var(--on-done-container)'},
    ),
    // A tile with a value that the Save button has not saved yet. A box shadow, not an outline: BeerCSS buttons inherit
    // the outline.
    css('.tile.unsaved').styles(raw: {'box-shadow': 'inset 0 0 0 2px var(--done)'}),
    css('.tile.wide').styles(padding: .all(0.75.rem), raw: {'grid-column': '1 / -1'}),
    // Yes/no and count tiles are one button. BeerCSS styles every <button>, so reset its size, color and layout here.
    // touch-action: no double-tap zoom, so that a double-tap on a count tile subtracts at once.
    css('.tile-main').styles(
      display: .flex,
      flexDirection: .column,
      alignItems: .start,
      justifyContent: .spaceBetween,
      gap: .all(0.75.rem),
      margin: .zero,
      padding: .all(0.75.rem),
      textAlign: .left,
      raw: {
        // border-box: BeerCSS buttons are content-box, so 100% plus the padding goes past the tile.
        'box-sizing': 'border-box',
        'inline-size': '100%',
        'block-size': 'auto',
        'min-block-size': '6rem',
        'border': '0',
        'border-radius': 'inherit',
        'background': 'transparent',
        'color': 'inherit',
        'box-shadow': 'none',
        'white-space': 'normal',
        'font-weight': '400',
        'touch-action': 'manipulation',
      },
    ),
    css('.tile.wide .tile-main').styles(
      flexDirection: .row,
      alignItems: .center,
      justifyContent: .start,
      padding: .zero,
      raw: {'min-block-size': '0'},
    ),
    css('.tile-text').styles(display: .flex, flexDirection: .column, raw: {'min-width': '0'}),
    // The counter of count tiles: top right, in the corner that the icon row leaves free.
    css('.tile-counter').styles(
      position: .absolute(top: 0.75.rem, right: 0.75.rem),
      fontSize: 1.rem,
      raw: {
        'line-height': '1',
        'pointer-events': 'none',
        'color': 'color-mix(in srgb, currentColor 70%, transparent)',
      },
    ),
    css('.tile-name').styles(fontSize: 1.rem, raw: {'line-height': '1.3'}),
    // Number tiles: a smaller value and ruler than in the table editor, so that the habit tiles fit on a phone screen.
    css('.tile.wide .editor').styles(
      margin: .only(top: 0.25.rem),
      gap: .all(0.25.rem),
    ),
    css('.tile.wide .number-editor .value input').styles(fontSize: 1.375.rem, raw: {'color': 'inherit'}),
    css('.tile.wide .number-editor .ruler').styles(raw: {'block-size': '2.75rem'}),
    // Green focus frame, not red: red looks like an error on a green tile.
    css('.tile.wide .number-editor .ruler:focus-visible').styles(raw: {'outline-color': 'var(--done)'}),
    css('.tile.wide .number-editor .tick span').styles(
      position: .absolute(top: 1.5.rem, left: 4.5.px),
    ),
  ]),
  css.media(MediaQuery.screen(minWidth: 640.px), [
    css('.tiles').styles(raw: {'grid-template-columns': 'repeat(4, minmax(0, 1fr))'}),
  ]),
  // The Save button of the Today tiles: at the end of the page, below the tiles, as wide as the tiles. border-box:
  // BeerCSS buttons are content-box, so 100% plus the padding goes past the tiles. The corners of the tiles.
  css('.save-button').styles(
    margin: .only(top: 1.5.rem, bottom: 1.rem),
    radius: .circular(16.px),
    fontSize: 1.rem,
    raw: {'box-sizing': 'border-box', 'inline-size': '100%', 'block-size': '3.25rem', 'margin-inline': '0'},
  ),
  // No changes: a quiet grey button with readable text, not the pale red of a disabled BeerCSS button.
  css('.save-button:disabled').styles(
    raw: {'background-color': 'var(--surface-container-highest)', 'color': 'var(--on-surface-variant)', 'opacity': '1'},
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
      textAlign: .left,
      fontWeight: .w400,
    ),
    css('th.name > div').styles(display: .flex, alignItems: .center, gap: .all(0.6.rem)),
    css('tr.editor-row td').styles(
      padding: .all(0.75.rem),
      textAlign: .left,
      raw: {'background-color': 'var(--surface-container)'},
    ),
  ]),

  // habit_table.dart: 31-day calendars. As many columns as fit, each at least 17.5rem wide.
  css('.calendars').styles(
    display: .grid,
    raw: {'grid-template-columns': 'repeat(auto-fill, minmax(17.5rem, 1fr))', 'gap': '0.75rem'},
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
      raw: {
        'grid-template-columns': 'auto repeat(7, 1fr)',
        'gap': '4px',
        'justify-items': 'center',
        'align-items': 'center',
      },
    ),
    css('.month small').styles(fontSize: 0.7.rem, raw: {'color': 'var(--on-surface-variant)'}),
    css('.month small.week').styles(
      padding: .only(right: 0.25.rem),
      raw: {'justify-self': 'end', 'white-space': 'nowrap'},
    ),
    css('.cell').styles(raw: {'inline-size': '1.6rem', 'block-size': '1.6rem'}),
    css('.editor').styles(margin: .only(top: 0.75.rem)),
  ]),

  // habit_table.dart: a metric name that opens the detail screen.
  css('a.metric-link').styles(
    display: .flex,
    alignItems: .center,
    gap: .all(0.6.rem),
    raw: {'color': 'inherit', 'text-decoration': 'none'},
  ),

  // metric_detail.dart: sections of the detail screen. charts.dart uses inline styles.
  // Wide screens: at most 60rem wide and centered, so that the cards keep their shape.
  css('.metric-detail', [
    css('&').styles(
      display: .flex,
      flexDirection: .column,
      gap: .all(1.rem),
      raw: {'max-width': '60rem', 'width': '100%', 'margin-inline': 'auto'},
    ),
    css('.detail-head').styles(gap: .all(0.5.rem)),
    css('.detail-head h5').styles(margin: .zero),
    // Charts: 1 column on phones, 2 on wider screens. Line charts and charts that scroll take the full width.
    // Dense: a small card fills the gap before a wide card.
    css('.detail-charts').styles(
      display: .grid,
      raw: {'grid-template-columns': 'minmax(0, 1fr)', 'grid-auto-flow': 'row dense', 'gap': '0.75rem'},
    ),
    // The time window: stays in view below the app bar while the page scrolls. Opaque, so that charts go behind it.
    css('.window-bar').styles(
      display: .flex,
      flexDirection: .column,
      gap: .all(0.5.rem),
      padding: .symmetric(vertical: 0.5.rem),
      raw: {'position': 'sticky', 'top': '4rem', 'z-index': '2', 'background-color': 'var(--surface)'},
    ),
    // Zoom buttons on the left, dates with arrows on the right. Narrow screens: the dates go below the zoom buttons.
    css('.window-row').styles(
      display: .flex,
      flexWrap: .wrap,
      alignItems: .center,
      justifyContent: .spaceBetween,
      gap: .all(0.5.rem),
    ),
    css('.window-zoom').styles(gap: .all(0.25.rem)),
    // A fixed width, so that the zoom buttons do not move when the label changes.
    css('.zoom-label').styles(raw: {'min-width': '5.5rem'}),
    css('.window-dates').styles(gap: .all(0.25.rem), raw: {'margin': '0 0 0 auto', 'font-size': '0.875rem'}),
    // The numbers, charts and heatmap of the window.
    css('.detail-body').styles(display: .flex, flexDirection: .column, gap: .all(1.rem)),
    css('.detail-section').styles(display: .flex, flexDirection: .column, gap: .all(0.5.rem)),
    css('.detail-section h6').styles(margin: .zero, raw: {'font-size': '1rem'}),
    css('.month-nav').styles(gap: .all(0.25.rem)),
    // Side drags on the charts and swipes on the calendar: vertical scroll stays, side moves go to the page code.
    css('.swipe').styles(raw: {'touch-action': 'pan-y', 'user-select': 'none', '-webkit-user-select': 'none'}),
    // The calendars fill the width, as the chart cards above, with larger cells than on the Today page.
    css('.calendars').styles(raw: {'grid-template-columns': 'minmax(0, 1fr)'}),
    css('article.calendar .cell').styles(raw: {'inline-size': '2.1rem', 'block-size': '2.1rem'}),
    // Phones: one month. Wider screens: the month before on the left, and a title with both months. The same
    // 2 columns and gap as the charts.
    css('.month-pair').styles(display: .grid, raw: {'grid-template-columns': 'minmax(0, 1fr)', 'gap': '0.75rem'}),
    css('.previous-month, .two-months').styles(display: .none),
  ]),
  css.media(MediaQuery.screen(minWidth: 640.px), [
    css('.metric-detail .month-pair').styles(raw: {'grid-template-columns': 'repeat(2, minmax(0, 1fr))'}),
    css('.metric-detail .previous-month').styles(display: .block),
    css('.metric-detail .two-months').styles(display: .inline),
    css('.metric-detail .single-month').styles(display: .none),
    css('.metric-detail .detail-charts').styles(raw: {'grid-template-columns': 'repeat(2, minmax(0, 1fr))'}),
    css('.metric-detail .chart-wide').styles(raw: {'grid-column': '1 / -1'}),
  ]),

  // trend_chart.dart uses inline styles.

  // Phones: smaller cells and less name padding, so the 5 days and the metric icons fit without scrolling.
  css.media(MediaQuery.screen(maxWidth: 480.px), [
    // charts.dart: more than 8 values above the bars, for example 13 weeks, fit without touching.
    // !important: the values have an inline font size.
    css('.bar-values.dense small').styles(raw: {'font-size': '0.6rem !important', 'letter-spacing': '-0.02em'}),
    css('table.habits .cell').styles(raw: {'inline-size': '1.9rem', 'block-size': '1.9rem'}),
    css('table.habits th.name').styles(padding: .only(left: 0.75.rem)),
  ]),
];
