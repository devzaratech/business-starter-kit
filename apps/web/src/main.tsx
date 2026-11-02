import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './control-plane.css';

type Section = 'overview' | 'projects' | 'environments' | 'services' | 'domains' | 'releases' | 'observability';
type Status = 'merged' | 'incomplete' | 'planned';

const navigation: { id: Section; title: string; symbol: string }[] = [
  { id: 'overview', title: 'Overview', symbol: '▦' },
  { id: 'projects', title: 'Projects', symbol: '◈' },
  { id: 'environments', title: 'Environments', symbol: '▤' },
  { id: 'services', title: 'Services', symbol: '⬡' },
  { id: 'domains', title: 'Domains & routes', symbol: '◎' },
  { id: 'releases', title: 'Releases', symbol: '↗' },
  { id: 'observability', title: 'Observability', symbol: '◉' },
];

const slices: { id: string; name: string; description: string; status: Status; next: string }[] = [
  { id: 'ES0', name: 'Architecture & contracts', description: 'Architecture review and versioned governance', status: 'merged', next: 'Maintain contracts and accepted ADRs' },
  { id: 'ES1', name: 'Projects & environments', description: 'Offline validation and deterministic dry-run planning', status: 'merged', next: 'Preserve independent project ownership' },
  { id: 'ES2', name: 'Compose & resource isolation', description: 'Driver and disposable test harness merged', status: 'incomplete', next: 'Runtime evidence, secret refs and label-drift coverage' },
  { id: 'ES3', name: 'Shared gateway & domains', description: 'Owned routes, conflict checks and safe reload', status: 'planned', next: 'Caddy adapter and disposable six-domain fixture' },
  { id: 'ES4', name: 'CI/CD & immutable releases', description: 'Per-project artifact lineage and promotion', status: 'planned', next: 'Digest-pinned release and approval evidence' },
  { id: 'ES5', name: 'Observability & recovery', description: 'Correlated events, rollback and restore', status: 'planned', next: 'Failure injection and disposable data recovery' },
  { id: 'ES6', name: 'Reproducible Golden Path', description: 'Two clean independent installation runs', status: 'planned', next: 'End-to-end conformance after ES3–ES5' },
];

const emptyStates: Record<Exclude<Section, 'overview'>, { description: string; requirements: string[] }> = {
  projects: {
    description: 'Projects will come from the authenticated Control Plane API. No project inventory is connected to this preview.',
    requirements: ['Scoped project listing', 'Owner-aware permissions', 'Desired and observed state'],
  },
  environments: {
    description: 'Environment names are arbitrary validated slugs, not a fixed dev/qa/prod dropdown. Nothing here is connected to a host.',
    requirements: ['Project-scoped environment listing', 'Policy and resource budgets', 'Verified placement'],
  },
  services: {
    description: 'Service status must be derived from an authorized driver and observed runtime, never from a static UI fixture.',
    requirements: ['Scoped service inventory', 'Health and resource observation', 'Guarded lifecycle operations'],
  },
  domains: {
    description: 'ES3 will supply owned hostnames and paths through a single installation-owned edge gateway.',
    requirements: ['Route registry and uniqueness', 'Candidate validation and safe reload', 'No private data-network exposure'],
  },
  releases: {
    description: 'Release and promotion actions will be enabled only after project-scoped operations and immutable OCI digests exist.',
    requirements: ['Build provenance and digest', 'Approvals and audit trail', 'Observed rollout and rollback'],
  },
  observability: {
    description: 'This preview does not invent uptime, CPU utilization, errors, or deployment history.',
    requirements: ['Real telemetry and correlation', 'Redacted operational audit', 'Recovery evidence'],
  },
};

function StatusPill({ status }: { status: Status }) {
  const labels: Record<Status, string> = { merged: 'Merged', incomplete: 'Needs evidence', planned: 'Planned' };
  return <span className={'status status-' + status}>{labels[status]}</span>;
}

function App() {
  const [section, setSection] = useState<Section>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find((item) => item.id === section) ?? navigation[0];

  function navigate(next: Section) {
    setSection(next);
    setMenuOpen(false);
  }

  return (
    <div className="bsk-shell">
      <aside className={'bsk-sidebar' + (menuOpen ? ' sidebar-open' : '')}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">B</div>
          <div><strong>Business Starter Kit</strong><span>Control Plane · Preview</span></div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="bsk-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <button type="button" key={item.id} className={'nav-item' + (item.id === section ? ' active' : '')}
              aria-current={item.id === section ? 'page' : undefined} onClick={() => navigate(item.id)}>
              <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>{item.title}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="offline-indicator"><span className="dot" /> API not connected</div>
          <small>Read-only development shell. No infrastructure actions.</small>
          <a href="https://github.com/devzaratech/business-starter-kit" target="_blank" rel="noreferrer">Repository ↗</a>
        </div>
      </aside>

      {menuOpen && <button type="button" className="mobile-overlay" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <main className="bsk-content">
        <header className="topbar">
          <button type="button" className="menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <div className="breadcrumb">BSK <span>/</span> {current.title}</div>
          <span className="preview-tag">DEVELOPMENT PREVIEW</span>
        </header>

        {section === 'overview' ? (
          <div className="page-container">
            <div className="page-heading">
              <div><div className="eyebrow">ENGINEERING GOLDEN PATH</div>
                <h1>Platform overview</h1>
                <p>One control plane. Multiple projects, environments and providers — without pretending planned capabilities are live.</p>
              </div>
              <a className="secondary-action" href="https://github.com/devzaratech/business-starter-kit/blob/main/docs/architecture/es0/engineering-slices.md" target="_blank" rel="noreferrer">Acceptance matrix ↗</a>
            </div>

            <div className="notice" role="status">
              <span className="notice-icon" aria-hidden="true">ⓘ</span>
              <div><strong>Control Plane API is not connected</strong>
                <p>This is a navigable UI shell, not a deployment console. ES2 runtime conformance and authenticated operations are still pending. No live runtime information is shown.</p>
              </div>
            </div>

            <div className="metric-grid">
              <div className="metric"><div>MERGED ENGINEERING SLICES</div><strong>2 <small>/ 7</small></strong><span>ES0 and ES1</span></div>
              <div className="metric"><div>RUNTIME CONFORMANCE</div><strong className="metric-word">Pending</strong><span>ES2 owner-reviewed evidence required</span></div>
              <div className="metric"><div>CONTROL PLANE API</div><strong className="metric-word">Not wired</strong><span>Authorization before mutations</span></div>
            </div>

            <div className="section-header"><div><h2>Engineering slices</h2><p>Repository implementation and acceptance are separate milestones.</p></div></div>
            <div className="slice-grid">
              {slices.map((slice) => (
                <article className="slice-card" key={slice.id}>
                  <div className="slice-card-top"><span className="slice-id">{slice.id}</span><StatusPill status={slice.status} /></div>
                  <h3>{slice.name}</h3><p>{slice.description}</p>
                  <div className="slice-next"><span>Next gate</span>{slice.next}</div>
                </article>
              ))}
            </div>
            <div className="disclaimer">Status is a documented snapshot, not a live GitHub/CI sync. Verify current commits, checks and runtime artifacts before claiming completion.</div>
          </div>
        ) : (
          <div className="page-container">
            <div className="page-heading"><div><div className="eyebrow">CONTROL PLANE</div>
              <h1>{current.title}</h1><p>Provider-neutral operations, secured by a single authorization and policy path.</p>
            </div></div>
            <section className="empty-panel">
              <div className="empty-symbol" aria-hidden="true">{current.symbol}</div>
              <h2>No connected data yet</h2>
              <p>{emptyStates[section].description}</p>
              <div className="integration-title">Required before enabling this screen</div>
              <ul>{emptyStates[section].requirements.map((item) => <li key={item}>{item}</li>)}</ul>
              <span className="disabled-action" aria-disabled="true">Actions unavailable until authenticated API integration</span>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
