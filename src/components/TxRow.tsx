import type { Account, Category, Transaction } from '../domain/types';
import { Icon } from './Icon';
import { Amount, CategoryBubble } from './ui';

export function TxRow({
  tx, category, accounts, onClick,
}: { tx: Transaction; category?: Category; accounts: Map<number, Account>; onClick?: () => void }) {
  const acc = accounts.get(tx.accountId)?.name ?? '–';
  const isTransfer = tx.type === 'transfer';
  const title = isTransfer ? 'Umbuchung' : category?.name ?? 'Ohne Kategorie';
  const sub = isTransfer ? `${acc} → ${accounts.get(tx.toAccountId!)?.name ?? '–'}` : [tx.note, acc].filter(Boolean).join(' · ');
  return (
    <button type="button" className="list-item" onClick={onClick}>
      {isTransfer ? (
        <span className="icon-bubble round" aria-hidden="true" style={{ color: 'var(--text-2)' }}>
          <Icon name="swap" size={18} />
        </span>
      ) : (
        <CategoryBubble emoji={category?.emoji ?? '❔'} color={category?.color ?? '#888'} round />
      )}
      <span className="grow">
        <span className="title ellipsis" style={{ display: 'block' }}>
          {title}
          {tx.recurringId != null && (
            <span className="faint" title="Wiederkehrend" style={{ marginLeft: 6, verticalAlign: -2 }}>
              <Icon name="repeat" size={13} />
            </span>
          )}
        </span>
        <span className="sub ellipsis" style={{ display: 'block' }}>{sub}</span>
      </span>
      <Amount cents={tx.amount} type={tx.type} />
    </button>
  );
}
