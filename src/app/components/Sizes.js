// The shared sizes of the app, in CSS pixels. theme.css has the same values as CSS variables, for example
// `--small-text`.

/** The smallest text of the app: chart labels, captions and the labels of the key numbers. */
export const SMALL_TEXT = 12;

/** The text of the main buttons. */
export const BUTTON_TEXT = 16;

/** The smallest width and height of a touch target. */
export const TOUCH_TARGET = 48;

/** From this width of the window, the app shows a navigation rail on the left, not a bottom navigation bar. */
export const RAIL_WIDTH = 840;

/** The largest width of a form or of a page with text only, so that the lines stay short on wide screens. */
export const FORM_WIDTH = 640;

/**
 * The content width of a wide screen: a 640 px window, as the `min-width: 640px` of the Dart CSS, without the 16 px
 * page padding on each side. From this width, the Today tiles have 4 columns and the month calendar shows 2 months.
 */
export const WIDE_CONTENT = 608;
