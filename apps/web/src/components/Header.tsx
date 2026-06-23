import { BrainCircuit, Menu, ShieldCheck } from 'lucide-react';

type HeaderProps = {
  activeView: 'home' | 'skills' | 'models' | 'settings';
  onNavigate: (view: HeaderProps['activeView']) => void;
  privacyMode: 'Local-only' | 'Local preferred' | 'Community Device';
};

export function Header({ activeView, onNavigate, privacyMode }: HeaderProps) {
  const links: Array<{ id: HeaderProps['activeView']; label: string }> = [
    { id: 'home', label: 'Overview' },
    { id: 'skills', label: 'Skills' },
    { id: 'models', label: 'Models' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="AIOS home" onClick={() => onNavigate('home')}>
        <span className="brand-mark"><BrainCircuit size={19} /></span>
        <span>AIOS<span className="brand-subtitle">Browser Hub</span></span>
      </a>
      <nav aria-label="Primary navigation">
        {links.map((link) => (
          <button key={link.id} className={activeView === link.id ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate(link.id)}>
            {link.label}
          </button>
        ))}
      </nav>
      <div className="header-status" title="Your local model and conversation data stay in this browser.">
        <ShieldCheck size={16} /> {privacyMode}
      </div>
      <button className="mobile-menu" aria-label="Open navigation"><Menu size={20} /></button>
    </header>
  );
}
