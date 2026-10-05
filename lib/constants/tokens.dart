/// Design values that both the app CSS (theme.dart) and the components with inline styles use. Plain Dart: theme.dart
/// runs on the Dart VM to create main.css.
library;

/// A filled day cell or bar: the primary color, a little lighter.
const filledColor = 'color-mix(in srgb, var(--primary) 70%, var(--surface-container-highest))';

/// An empty day cell.
const emptyColor = 'var(--surface-container-highest)';

/// The width of one ruler tick of the number editor, in pixels.
const rulerTick = 9;

/// From this width in pixels, the layout uses the wide-screen rules.
const wideScreen = 640;
