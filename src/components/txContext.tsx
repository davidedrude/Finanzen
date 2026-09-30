import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Transaction } from '../domain/types';
import { TxSheet } from './TxSheet';

const Ctx = createContext<(tx?: Transaction) => void>(() => {});

export function TxSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; tx?: Transaction; n: number }>({ open: false, n: 0 });
  const open = useCallback((tx?: Transaction) => setState((s) => ({ open: true, tx, n: s.n + 1 })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {state.open && <TxSheet key={state.n} initial={state.tx} onClose={close} />}
    </Ctx.Provider>
  );
}

export const useTxSheet = () => useContext(Ctx);
