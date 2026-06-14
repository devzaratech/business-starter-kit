import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Business Starter Kit</h1>
      <p>Private, sanitized, modular SaaS foundation.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
