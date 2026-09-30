import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { CategoryBubble, ColorPicker, Field, PageHeader, Segmented, Sheet } from '../components/ui';
import { db } from '../db/db';
import { useCategories } from '../db/hooks';
import { EMOJI_CHOICES, PALETTE } from '../db/seed';
import type { Category, CategoryKind } from '../domain/types';

export function CategoriesPage() {
  const categories = useCategories();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  if (!categories) return null;

  const list = categories.filter((c) => c.kind === kind).sort((a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order);
  const blank: Category = { name: '', emoji: '📦', color: PALETTE[0], kind, archived: false, lastUsedAt: 0, order: list.length };

  return (
    <div className="page stack">
      <PageHeader
        title="Kategorien"
        back
        action={<button className="icon-btn" onClick={() => setEditing(blank)} aria-label="Kategorie hinzufügen"><Icon name="plus" /></button>}
      />
      <Segmented label="Art" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Ausgaben' }, { value: 'income', label: 'Einnahmen' }]} />
      <div className="list">
        {list.map((c) => (
          <button key={c.id} className="list-item" onClick={() => setEditing(c)} style={c.archived ? { opacity: 0.5 } : undefined}>
            <CategoryBubble emoji={c.emoji} color={c.color} />
            <span className="grow title">{c.name}{c.archived && <span className="sub"> · ausgeblendet</span>}</span>
            <span className="legend-swatch" style={{ background: c.color, borderRadius: '50%' }} />
            <span className="chev"><Icon name="chevron" size={18} /></span>
          </button>
        ))}
      </div>
      <button className="btn block" onClick={() => setEditing(blank)}><Icon name="plus" size={18} /> Kategorie hinzufügen</button>
      {editing && <CategorySheet category={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategorySheet({ category, onClose }: { category: Category; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);
  const [color, setColor] = useState(category.color);
  const isNew = category.id == null;

  async function save() {
    if (!name.trim()) return toast('Bitte einen Namen eingeben.');
    await db.categories.put({ ...category, name: name.trim(), emoji: emoji.trim() || '📦', color });
    onClose();
  }

  async function remove() {
    const used =
      (await db.transactions.where('categoryId').equals(category.id!).count()) +
      (await db.recurring.filter((r) => r.categoryId === category.id).count());
    if (used > 0) {
      await db.categories.update(category.id!, { archived: !category.archived });
      toast(category.archived ? 'Kategorie wieder eingeblendet' : 'Kategorie ausgeblendet – bestehende Buchungen bleiben');
    } else {
      await db.categories.delete(category.id!);
      await db.budgets.where('categoryId').equals(category.id!).delete();
      toast('Kategorie gelöscht');
    }
    onClose();
  }

  return (
    <Sheet title={isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="row">
          <CategoryBubble emoji={emoji} color={color} />
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus={isNew} maxLength={30} aria-label="Name" />
        </div>
        <Field label="Emoji">
          <input className="input" value={emoji} onChange={(e) => setEmoji(lastGrapheme(e.target.value))} style={{ width: 80, textAlign: 'center', fontSize: 22 }} aria-label="Eigenes Emoji" />
        </Field>
        <div className="emoji-grid">
          {EMOJI_CHOICES.map((e) => (
            <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
        <div className="field">
          <span>Farbe</span>
          <ColorPicker value={color} onChange={setColor} colors={PALETTE} />
        </div>
        <button className="btn primary block" type="submit">Speichern</button>
        {!isNew && (
          <button className="btn danger block" type="button" onClick={remove}>
            {category.archived ? 'Wieder einblenden' : 'Löschen / Ausblenden'}
          </button>
        )}
      </form>
    </Sheet>
  );
}

/** Nur das zuletzt eingegebene Emoji behalten (auch zusammengesetzte wie 👨‍👩‍👧). */
function lastGrapheme(v: string): string {
  const parts = [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(v)];
  return parts.length ? parts[parts.length - 1].segment : '';
}
