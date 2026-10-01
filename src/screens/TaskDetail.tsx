import { labels, genderOptions, raceOptions, ageOptions } from '../labels';

export type Details = { gender: string | null; race: string | null; age: string | null };

type Props = {
  task: string;
  details: Details;
  onChange: (d: Details) => void;
  onBack: () => void;
  onReset: () => void;
  onSubmit: () => void;
  submitting: boolean;
};

function Choices({
  heading,
  options,
  value,
  onPick,
}: {
  heading: string;
  options: string[];
  value: string | null;
  onPick: (v: string | null) => void;
}) {
  return (
    <section className="section">
      <h2 className="section-heading">{heading}</h2>
      <div className="chips" role="radiogroup" aria-label={heading}>
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              role="radio"
              aria-checked={on}
              className={`chip${on ? ' chip--on' : ''}`}
              // Tapping the selected option again clears it.
              onClick={() => onPick(on ? null : opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function TaskDetail({ task, details, onChange, onBack, onReset, onSubmit, submitting }: Props) {
  return (
    <div className="screen">
      <nav className="navbar">
        <button className="back" onClick={onBack} aria-label={labels.back}>
          <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
            <path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="nav-title">{labels.detailsTitle}</span>
      </nav>

      <main className="scroll">
        <p className="task-title">{task}</p>

        <Choices
          heading={labels.genderHeading}
          options={genderOptions}
          value={details.gender}
          onPick={(gender) => onChange({ ...details, gender })}
        />
        <Choices
          heading={labels.raceHeading}
          options={raceOptions}
          value={details.race}
          onPick={(race) => onChange({ ...details, race })}
        />
        <Choices
          heading={labels.ageHeading}
          options={ageOptions}
          value={details.age}
          onPick={(age) => onChange({ ...details, age })}
        />
      </main>

      <footer className="footer footer--pair">
        <button className="secondary" onClick={onReset} disabled={submitting}>
          {labels.reset}
        </button>
        <button className="primary" onClick={onSubmit} disabled={submitting}>
          {submitting ? labels.submitting : labels.submit}
        </button>
      </footer>
    </div>
  );
}
