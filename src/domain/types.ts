/** Geldbeträge immer als ganze Cent. */
export type Cents = number;
/** Kalenderdatum im Format YYYY-MM-DD (ohne Zeitzone). */
export type ISODate = string;
/** Monat im Format YYYY-MM. */
export type MonthKey = string;

export type TxType = 'income' | 'expense' | 'transfer';
export type AccountType = 'giro' | 'cash' | 'savings' | 'other';
export type CategoryKind = 'expense' | 'income';
export type Interval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  startBalance: Cents;
  color: string;
  archived: boolean;
  order: number;
}

export interface Category {
  id?: number;
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
  archived: boolean;
  lastUsedAt: number;
  order: number;
}

export interface Transaction {
  id?: number;
  type: TxType;
  /** Immer positiv; die Richtung ergibt sich aus `type`. */
  amount: Cents;
  date: ISODate;
  categoryId?: number;
  accountId: number;
  /** Nur bei Umbuchungen: Zielkonto. */
  toAccountId?: number;
  note?: string;
  recurringId?: number;
  importHash?: string;
  createdAt: number;
}

export interface Recurring {
  id?: number;
  type: TxType;
  amount: Cents;
  categoryId?: number;
  accountId: number;
  toAccountId?: number;
  note?: string;
  interval: Interval;
  startDate: ISODate;
  endDate?: ISODate;
  /** Nächster noch nicht angelegter Termin. */
  nextDue: ISODate;
  active: boolean;
}

export interface Budget {
  id?: number;
  categoryId: number;
  monthlyLimit: Cents;
}

export interface Goal {
  id?: number;
  name: string;
  emoji: string;
  targetAmount: Cents;
  targetDate: ISODate;
  startDate: ISODate;
  /** Stand beim Anlegen – Basis für den linearen Plan. */
  startAmount: Cents;
  /** Ist ein Konto verknüpft, gilt dessen Saldo als Stand. */
  accountId?: number;
  /** Manuell verbuchter Stand (wenn kein Konto verknüpft). */
  manualAmount: Cents;
}

export interface Meta {
  key: string;
  value: unknown;
}
