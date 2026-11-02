import { emptyStates, navigation, slices, type Section, type Status } from './content';

const repository = 'https://github.com/devzaratech/business-starter-kit';
const statusLabels: Record<Status, string> = { merged: 'Merged', incomplete: 'Needs evidence', planned: 'Planned' };

export function Overview() {
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Engineering Golden Path</p><h1 tabIndex={-1} id="page-title">Platform overview</h1>
        <p>The foundation for independent projects and environments, with explicit engineering gates.</p></div>
      <a className="secondary-action" href={`${repository}/blob/main/docs/architecture/es0/engineering-slices.md`}>Acceptance matrix <span aria-hidden="true">↗</span></a>
    </div>
    <aside className="notice" aria-labelledby="preview-notice">
      <span className="notice-icon" aria-hidden="true">ⓘ</span>
      <div><h2 id="preview-notice">Read-only preview · API not connected</h2>
        <p>No live inventory, runtime status or telemetry is shown. ES2 acceptance and authenticated administrative operations remain incomplete.</p></div>
    </aside>
    <section aria-labelledby="snapshot-title">
      <div className="section-header"><h2 id="snapshot-title">Engineering snapshot</h2>
        <p>As of <time dateTime="2026-11-02">2026-11-02</time> · Maintained manually, not live GitHub or CI data.</p></div>
      <dl className="metric-grid">
        <div className="metric"><dt>Foundation</dt><dd><span className="metric-value">Offline planning</span><p>ES0 and ES1 are merged.</p></dd></div>
        <div className="metric"><dt>ES2 acceptance</dt><dd><span className="metric-value">Incomplete</span><p>Runtime evidence and remaining gaps require review.</p></dd></div>
        <div className="metric"><dt>Control Plane API</dt><dd><span className="metric-value">Not connected</span><p>Authentication and scoped policy checks come first.</p></dd></div>
      </dl>
      <p className="disclaimer">Code merged does not mean acceptance complete. Verify current commits, checks and runtime artifacts before making operational decisions.</p>
      <div className="slice-grid">
        {slices.map(slice => <article className="slice-card" key={slice.id} aria-labelledby={`slice-${slice.id}`}>
          <div className="slice-card-top"><span className="slice-id">{slice.id}</span>
            <span className={`status status-${slice.status}`}>{statusLabels[slice.status]}</span></div>
          <h3 id={`slice-${slice.id}`}>{slice.name}</h3><p>{slice.description}</p>
          <div className="slice-next"><span>Next gate</span>{slice.next}</div>
        </article>)}
      </div>
    </section>
  </>;
}

export function EmptyState({ section }: { section: Exclude<Section, 'overview'> }) {
  const current = navigation.find(item => item.id === section)!;
  const state = emptyStates[section];
  return <>
    <div className="page-heading"><div><p className="eyebrow">Control Plane</p>
      <h1 tabIndex={-1} id="page-title">{current.title}</h1><p>Project-scoped visibility through a shared, authenticated API.</p></div></div>
    <section className="empty-panel" aria-labelledby="empty-title">
      <span className="empty-symbol" aria-hidden="true">{current.symbol}</span>
      <h2 id="empty-title">No connected data yet</h2><p>{state.description}</p>
      <div id={`${section}-requirements`} className="requirements">
        <h3>Required before enabling operations</h3>
        <p>An authenticated Control Plane API with project-scoped authorization, plus:</p>
        <ul>{state.requirements.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
      <button type="button" disabled aria-describedby={`${section}-requirements`}>Operations unavailable</button>
    </section>
  </>;
}
