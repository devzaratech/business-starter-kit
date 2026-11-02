import { useEffect, useRef, useState } from 'react';
import { navigation, type Section } from './content';
import { EmptyState, Overview } from './components';

const mobileQuery = '(max-width: 700px)';

export function App() {
  const [section, setSection] = useState<Section>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia(mobileQuery).matches);
  const toggle = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const current = navigation.find(item => item.id === section)!;

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    function resize() {
      const focusInside = sidebar.current?.contains(document.activeElement);
      const focusOnToggle = document.activeElement === toggle.current;
      setMobile(media.matches); setMenuOpen(false);
      requestAnimationFrame(() => {
        if (media.matches && focusInside) toggle.current?.focus();
        if (!media.matches && focusOnToggle) sidebar.current?.querySelector<HTMLButtonElement>('[aria-current]')?.focus();
      });
    }
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  useEffect(() => {
    if (mobile && menuOpen) sidebar.current?.querySelector<HTMLButtonElement>('[aria-current]')?.focus();
  }, [menuOpen, mobile]);

  useEffect(() => { document.title = `${current.title} · BSK preview`; }, [current.title]);

  function closeMenu() { setMenuOpen(false); toggle.current?.focus(); }
  function navigate(next: Section) {
    setSection(next); setMenuOpen(false);
    requestAnimationFrame(() => main.current?.querySelector<HTMLElement>('h1')?.focus());
  }

  return <div className="bsk-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar">
      <button ref={toggle} type="button" className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobile && menuOpen} aria-controls="primary-sidebar" onClick={() => setMenuOpen(open => !open)}
        onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { event.preventDefault(); closeMenu(); } }}>☰</button>
      <p className="breadcrumb">BSK <span aria-hidden="true">/</span> {current.title}</p>
      <span className="preview-tag">Development preview</span>
    </header>
    <aside ref={sidebar} id="primary-sidebar" className="bsk-sidebar" hidden={mobile && !menuOpen}
      onKeyDown={event => { if (event.key === 'Escape' && mobile && menuOpen) { event.preventDefault(); closeMenu(); } }}
      onBlur={event => { if (mobile && event.relatedTarget !== toggle.current && !event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
      <div className="brand"><span className="brand-mark" aria-hidden="true">B</span>
        <div><strong>Business Starter Kit</strong><span>Control Plane · Preview</span></div></div>
      <p className="nav-caption">Workspace</p>
      <nav aria-label="Primary navigation"><ul className="bsk-nav">
        {navigation.map(item => <li key={item.id}><button type="button" className="nav-item"
          aria-current={item.id === section ? 'page' : undefined} onClick={() => navigate(item.id)}>
          <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>{item.title}</button></li>)}
      </ul></nav>
      <footer className="sidebar-footer"><p className="offline-indicator"><span className="dot" aria-hidden="true"/>API not connected</p>
        <p>Read-only development shell. No infrastructure actions.</p>
        <a href="https://github.com/devzaratech/business-starter-kit">Repository <span aria-hidden="true">↗</span></a></footer>
    </aside>
    <main ref={main} id="main-content" tabIndex={-1} className="bsk-content"><div className="page-container">
      {section === 'overview' ? <Overview /> : <EmptyState section={section} />}
    </div></main>
  </div>;
}
