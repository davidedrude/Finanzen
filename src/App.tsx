import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './components/Icon';
import { ToastProvider, useToast } from './components/toast';
import { TxSheetProvider, useTxSheet } from './components/txContext';
import { useAccounts } from './db/hooks';
import { runDueRecurring } from './db/recurringRunner';
import { AccountsPage } from './pages/Accounts';
import { BackupPage } from './pages/Backup';
import { BudgetsPage } from './pages/Budgets';
import { CategoriesPage } from './pages/Categories';
import { GoalsPage } from './pages/Goals';
import { ImportPage } from './pages/Import';
import { MorePage } from './pages/More';
import { Onboarding } from './pages/Onboarding';
import { OverviewPage } from './pages/Overview';
import { RecurringPage } from './pages/Recurring';
import { ReportsPage } from './pages/Reports';
import { TransactionsPage } from './pages/Transactions';

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Übersicht', icon: 'home' },
  { to: '/buchungen', label: 'Buchungen', icon: 'list' },
  { to: '/auswertung', label: 'Auswertung', icon: 'chart' },
  { to: '/mehr', label: 'Mehr', icon: 'more' },
];

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <TxSheetProvider>
          <Shell />
        </TxSheetProvider>
      </ToastProvider>
    </HashRouter>
  );
}

function Shell() {
  const accounts = useAccounts(true);
  const openTx = useTxSheet();
  const toast = useToast();
  const { pathname } = useLocation();

  // Wiederkehrende Buchungen beim Start und beim Zurückkehren in die App anlegen
  useEffect(() => {
    const run = () =>
      runDueRecurring()
        .then((n) => n > 0 && toast(n === 1 ? '1 wiederkehrende Buchung angelegt' : `${n} wiederkehrende Buchungen angelegt`))
        .catch(console.error);
    run();
    const onVis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [toast]);

  // Browser bitten, die Daten nicht automatisch zu löschen
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (accounts === undefined) return null;
  if (accounts.length === 0) {
    return (
      <main className="app">
        <Onboarding />
      </main>
    );
  }

  return (
    <>
      <main className="app">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/buchungen" element={<TransactionsPage />} />
          <Route path="/auswertung" element={<ReportsPage />} />
          <Route path="/mehr" element={<MorePage />} />
          <Route path="/mehr/konten" element={<AccountsPage />} />
          <Route path="/mehr/kategorien" element={<CategoriesPage />} />
          <Route path="/mehr/budgets" element={<BudgetsPage />} />
          <Route path="/mehr/sparziele" element={<GoalsPage />} />
          <Route path="/mehr/wiederkehrend" element={<RecurringPage />} />
          <Route path="/mehr/import" element={<ImportPage />} />
          <Route path="/mehr/backup" element={<BackupPage />} />
          <Route path="*" element={<OverviewPage />} />
        </Routes>
      </main>
      <button className="fab" onClick={() => openTx()} aria-label="Neue Buchung">
        <Icon name="plus" size={28} stroke={2.4} />
      </button>
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="nav-inner">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive || (t.to === '/mehr' && pathname.startsWith('/mehr')) ? 'active' : '')}>
              <Icon name={t.icon} size={24} stroke={1.9} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
