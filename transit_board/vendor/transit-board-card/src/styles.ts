export const BOARD_STYLES = `
:host { display: block; }
* { box-sizing: border-box; }
ha-card {
  display: block; overflow: hidden; border: 5px solid #1c2933; border-radius: 7px;
  background: #0b1218; color: #102431; font-family: Arial, Helvetica, sans-serif;
  box-shadow: inset 0 0 0 1px #05080c, 0 10px 24px rgba(15,23,42,.22);
}
.board { background: #eaf7fb; padding: 18px 20px 14px; }
header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
h2 { margin: 0; font-size: 1.1rem; line-height: 1.4; overflow-wrap: anywhere; }
.heading-label { color: #51636f; font-size: .8rem; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { color: #51636f; text-align: left; font-size: .72rem; padding-bottom: 6px; font-weight: 400; }
th:first-child { width: 64px; }
th:last-child { width: 72px; text-align: right; }
td { border-top: 1px solid #c9dbe3; padding: 10px 0; background: rgba(255,255,255,.56); vertical-align: middle; }
td:nth-child(2) { padding-left: 10px; padding-right: 8px; }
.badge { display: inline-block; background: #51636f; border-radius: 4px; color: white; font-size: 1rem; font-weight: 800; padding: 5px 7px; max-width: 100%; overflow-wrap: anywhere; }
.subway { background: #005aa7; }
.suburban { background: #008d36; border-radius: 999px; }
.bus { background: #7c3f98; border-radius: 999px; }
.tram { background: #c31632; }
.ferry { background: #007f92; }
.regional, .express { background: #a12224; }
.destination { font-size: 1.05rem; font-weight: 700; overflow-wrap: anywhere; }
.details { color: #51636f; font-size: .76rem; line-height: 1.4; margin-top: 4px; overflow-wrap: anywhere; }
.due { text-align: right; font-size: 1.75rem; font-weight: 900; white-space: nowrap; }
.cancelled .destination { text-decoration: line-through; }
.cancelled .details { color: #912728; font-weight: 700; }
.empty { font-size: .95rem; line-height: 1.5; }
.status { color: #51636f; font-size: .75rem; line-height: 1.5; margin: 10px 0 0; }
.warning { color: #8b4118; font-weight: 600; }
caption { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); }
@media (max-width: 380px) {
  .board { padding: 14px 12px 12px; }
  .heading-label { display: none; }
  th:first-child { width: 55px; }
  th:last-child { width: 58px; }
  .due { font-size: 1.5rem; }
}
`;
