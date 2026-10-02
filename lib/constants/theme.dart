import 'package:jaspr/dom.dart';

/// App styles on top of BeerCSS (Material Design 3). The @css annotation adds them to main.css.
///
/// BeerCSS gives the base look. These rules cover only what BeerCSS has no component for: the habit table
/// and calendars. Colors use the Material theme variables, so they follow the theme and dark mode.
@css
List<StyleRule> get styles => [
  // today.dart
  css('nav.chips, nav.toolbar-row').styles(margin: .only(bottom: 0.75.rem)),
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
  // The range chip has the same border as the group chips.
  css('nav.toolbar-row .chip').styles(
    raw: {
      'color': 'var(--on-surface)',
      'border-color': 'color-mix(in srgb, var(--primary) 30%, var(--outline-variant))',
    },
  ),
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

  // Phones: the week table shows 5 days (DayRange.phoneDays) with smaller cells, so the icons fit without scrolling.
  // The width must match the phone media query in lib/pages/today.dart.
  css.media(MediaQuery.screen(maxWidth: 480.px), [
    css('table.habits .cell').styles(raw: {'inline-size': '1.9rem', 'block-size': '1.9rem'}),
    css('table.habits th.name').styles(padding: .only(left: 0.75.rem)),
  ]),
];
