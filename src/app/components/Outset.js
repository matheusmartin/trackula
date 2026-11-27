/**
 * The style that makes the box of an element `horizontal` pixels larger on the left and on the right, and `vertical`
 * pixels larger at the top and at the bottom, with the same padding inside. The layout does not change: the element
 * keeps its place, and the content keeps its size and its position. Use it on a link or a button, so that the hover
 * and focus highlight has space around the content, and the content stays aligned with the other content.
 *
 * Example: `<button style={outset(8, 4)}>`. A click in the outset space also clicks the element.
 * @param {number} horizontal
 * @param {number} vertical
 * @returns {{ margin: string, padding: string }}
 */
export function outset(horizontal, vertical) {
  return { margin: `${-vertical}px ${-horizontal}px`, padding: `${vertical}px ${horizontal}px` };
}
