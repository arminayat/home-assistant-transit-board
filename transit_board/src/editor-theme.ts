/** App presentation for the pinned editor; keep its form behavior and source intact. */
const styles = `
  :host { font: inherit; }
  .editor { grid-template-columns: minmax(0, 1fr) minmax(150px, .4fr); gap: 24px 20px; padding: 0; }
  .editor > .search, .stops { grid-column: 1 / -1; }
  label { min-width: 0; gap: 8px; font-size: .875rem; font-weight: 600; line-height: 1.5; }
  input:not([type=checkbox]), select {
    min-height: 46px; padding: 11px 13px; border-radius: 10px;
    background: var(--control-background, #fff); color: var(--primary-text-color);
    border-color: var(--divider-color); font: inherit; font-size: 1rem; font-weight: 400;
  }
  input::placeholder { color: var(--secondary-text-color); opacity: 1; }
  input:not([type=checkbox]):hover, select:hover { border-color: var(--secondary-text-color); }
  input:not([type=checkbox]):focus-visible, select:focus-visible {
    outline: 2px solid var(--primary-color); outline-offset: 2px; border-color: var(--primary-color);
  }
  input[aria-invalid=true] { border-color: var(--error-color); }
  button {
    min-height: 44px; padding: 10px 16px; border: 1px solid var(--divider-color); border-radius: 10px;
    background: var(--control-background, #fff); color: var(--primary-color);
    font-size: .875rem; font-weight: 600; line-height: 1.5;
  }
  button:hover:not(:disabled) { background: var(--primary-tint); border-color: var(--primary-color); }
  button:disabled { opacity: .5; cursor: default; }
  fieldset { padding: 18px; border-color: var(--divider-color); border-radius: 12px; }
  legend { padding: 0 6px; font-size: .875rem; font-weight: 650; }
  .stops { gap: 24px; }
  .stops > p { margin: 0; padding: 20px; border: 1px dashed var(--divider-color);
    border-radius: 12px; color: var(--secondary-text-color); font-size: .9rem; text-align: center; }
  .stop { gap: 20px; }
  .stop > legend { font-size: 1rem; }
  .stop > button { justify-self: end; color: var(--error-color); }
  .stop > button:hover { background: var(--settings-surface); border-color: var(--error-color); }
  .stop > fieldset { padding: 0; border: 0; }
  .stop > fieldset > legend { padding: 0; margin-bottom: 10px; }
  .modes { gap: 8px; }
  .modes label {
    min-height: 42px; gap: 8px; padding: 8px 12px; border: 1px solid var(--divider-color);
    border-radius: 9px; background: var(--control-background, #fff); font-weight: 500; cursor: pointer;
  }
  .modes label:has(:checked) { border-color: var(--primary-color); background: var(--primary-tint); }
  .modes label:focus-within { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  input[type=checkbox] { width: 17px; height: 17px; margin: 0; accent-color: var(--primary-color); }
  .search { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 16px;
    border-radius: 12px; background: var(--settings-surface); }
  .search > label:first-child { grid-column: 1; }
  .search > label:not(:first-child) { grid-column: 1 / -1; }
  .search > button { grid-column: 2; grid-row: 1; align-self: end; }
  .search > .status { grid-column: 1 / -1; }
  .status { font-size: .85rem; font-weight: 400; }
  .status:empty { display: none; }
  .direction { gap: 12px; font-size: .875rem; }
  .direction > span { font-weight: 600; }
  .direction > button { margin-left: auto; }
  @media (max-width: 600px) {
    .editor { grid-template-columns: minmax(0, 1fr); gap: 20px; }
    fieldset { padding: 14px; }
    .search { padding: 12px; grid-template-columns: minmax(0, 1fr); }
    .search > label:first-child, .search > button { grid-column: 1; }
    .search > button { grid-row: auto; justify-self: start; }
    .direction > button { margin-left: 0; }
  }
`;

export function applyEditorTheme(editor: HTMLElement): void {
  const root = editor.shadowRoot;
  if (!root || !('adoptedStyleSheets' in root) || typeof CSSStyleSheet === 'undefined' ||
      !('replaceSync' in CSSStyleSheet.prototype)) return;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles);
  // The editor replaces its child nodes when changing cards. Adopted styles survive.
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}
