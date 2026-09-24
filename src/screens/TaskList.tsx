import { useState, type FormEvent } from 'react';
import { labels } from '../labels';
import { sortAlpha, sortFrequent, type Compliment } from '../compliments';

export type Tab = 'frequent' | 'alpha';

type Props = {
  compliments: Compliment[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  selected: string | null;
  onSelect: (name: string) => void;
  onAdd: (name: string) => void;
  onNext: () => void;
  pending: number;
};

export function TaskList({ compliments, tab, onTab, selected, onSelect, onAdd, onNext, pending }: Props) {
  const [draft, setDraft] = useState('');
  const items = tab === 'frequent' ? sortFrequent(compliments) : sortAlpha(compliments);

  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim().replace(/\s+/g, ' ');
    if (!name) return;
    onAdd(name);
    setDraft('');
  };

  return (
    <div className="screen">
      <header className="large-header">
        <h1>{labels.appTitle}</h1>
        {pending > 0 && <span className="muted small">{labels.pending(pending)}</span>}
      </header>

      <div className="segmented" role="tablist">
        {(
          [
            ['frequent', labels.tabFrequent],
            ['alpha', labels.tabAlpha],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => onTab(key)}
          >
            {text}
          </button>
        ))}
      </div>

      <main className="scroll">
        {items.length === 0 ? (
          <p className="muted empty">{labels.emptyList}</p>
        ) : (
          <ul className="group checklist" role="radiogroup">
            {items.map((c) => {
              const isSel = c.name === selected;
              return (
                <li key={c.name}>
                  <button role="radio" aria-checked={isSel} className="row" onClick={() => onSelect(c.name)}>
                    <span className={`check${isSel ? ' check--on' : ''}`} aria-hidden="true" />
                    <span className="row-text">{c.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="footer">
        <form className="add-row" onSubmit={submitDraft}>
          <span className="plus" aria-hidden="true">+</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={labels.addPlaceholder}
            aria-label={labels.addPlaceholder}
            maxLength={80}
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
          />
          {draft.trim() && (
            <button type="submit" className="link-button">
              {labels.addButton}
            </button>
          )}
        </form>
        <button className="primary" disabled={!selected} onClick={onNext}>
          {labels.next}
        </button>
      </footer>
    </div>
  );
}
