import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { PageHeader } from '../components/ui';

const items: { to: string; icon: IconName; title: string; sub: string }[] = [
  { to: '/mehr/konten', icon: 'wallet', title: 'Konten', sub: 'Girokonto, Bargeld, Tagesgeld …' },
  { to: '/mehr/kategorien', icon: 'tag', title: 'Kategorien', sub: 'Namen, Farben und Emojis' },
  { to: '/mehr/budgets', icon: 'pie', title: 'Budgets', sub: 'Monatslimits pro Kategorie' },
  { to: '/mehr/sparziele', icon: 'target', title: 'Sparziele', sub: 'Zielbetrag und Zieldatum' },
  { to: '/mehr/wiederkehrend', icon: 'repeat', title: 'Wiederkehrende Buchungen', sub: 'Miete, Abos, Gehalt' },
  { to: '/mehr/import', icon: 'upload', title: 'CSV-Import', sub: 'Kontoauszug einlesen' },
  { to: '/mehr/backup', icon: 'download', title: 'Backup & Daten', sub: 'Export, Import, Speicher' },
];

export function MorePage() {
  return (
    <div className="page">
      <PageHeader title="Mehr" />
      <nav className="list">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="list-item">
            <span className="icon-bubble" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>
              <Icon name={i.icon} size={20} />
            </span>
            <span className="grow">
              <span className="title" style={{ display: 'block' }}>{i.title}</span>
              <span className="sub">{i.sub}</span>
            </span>
            <span className="chev"><Icon name="chevron" size={18} /></span>
          </Link>
        ))}
      </nav>
      <p className="hint" style={{ textAlign: 'center', marginTop: 24 }}>
        Finanzen · Alle Daten bleiben lokal auf diesem Gerät.
      </p>
    </div>
  );
}
