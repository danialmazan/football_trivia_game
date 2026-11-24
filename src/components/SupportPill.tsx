/**
 * Ko-fi support pill (danielalmazan.com shared site-footer drop-in, loaded from index.html).
 * Rendered only at the bottom of the home screen and on final results screens — never mid-game.
 * The shared script fills the inner slot; React owns the slot element, so it disappears with its screen.
 */
export function SupportPill() {
  return (
    <div className="support-row">
      <div data-dani-support="" data-variant="compact" data-gap="0px" />
    </div>
  )
}
