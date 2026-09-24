import { labels, genderOptions, raceOptions, ageOptions } from '../labels';

export type Details = { gender: string | null; race: string | null; age: string | null };

type Props = {
  task: string;
  details: Details;
  onChange: (d: Details) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
};

function Choices({
  heading,
  options,
  value,
  onPick,
  columns,
}: {
  heading: string;
  options: string[];
  value: string | null;
  onPick: (v: string | null) => void;
  columns: number;
}) {
  return (
    <section className="section">
      <h2 className="section-heading">{heading}</h2>
      <div className="choices" role="radiogroup" aria-label={heading} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              role="radio"
              aria-checked={on}
              className={`choice${on ? ' choice--on' : ''}`}
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

export function TaskDetail({ task, details, onChange, onBack, onSubmit, submitting }: Props) {
  return (
    <div className="screen">
      <nav className="navbar">
        <button className="back" onClick={onBack}>
          <span aria-hidden="true">‹</span> {labels.back}
        </button>
        <span className="nav-title">{labels.detailsTitle}</span>
        <span className="nav-spacer" />
      </nav>

      <main className="scroll">
        <div className="group task-title">
          <span className="check check--on" aria-hidden="true" />
          <span className="row-text">{task}</span>
        </div>

        <Choices
          heading={labels.genderHeading}
          options={genderOptions}
          value={details.gender}
          onPick={(gender) => onChange({ ...details, gender })}
          columns={2}
        />
        <Choices
          heading={labels.raceHeading}
          options={raceOptions}
          value={details.race}
          onPick={(race) => onChange({ ...details, race })}
          columns={2}
        />
        <Choices
          heading={labels.ageHeading}
          options={ageOptions}
          value={details.age}
          onPick={(age) => onChange({ ...details, age })}
          columns={4}
        />
      </main>

      <footer className="footer">
        <button className="primary" onClick={onSubmit} disabled={submitting}>
          {submitting ? labels.submitting : labels.submit}
        </button>
      </footer>
    </div>
  );
}
