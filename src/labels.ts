/**
 * Every piece of user-facing text lives here. Keep it neutral: anyone glancing
 * at the screen should see an ordinary task list.
 *
 * The option values below are what gets written to the Sheet. Headings are
 * deliberately vague ("Type" = gender, "Group" = race, "Range" = age).
 */

export const labels = {
  appTitle: 'Tasks',

  // Screen 1
  tabFrequent: 'Frequent',
  tabAlpha: 'A–Z',
  addPlaceholder: 'Add task',
  addButton: 'Add',
  next: 'Next →',
  emptyList: 'No tasks',

  // Screen 2
  back: 'Tasks',
  detailsTitle: 'Details',
  genderHeading: 'Type',
  raceHeading: 'Group',
  ageHeading: 'Range',
  submit: 'Submit',
  reset: 'Reset',
  submitting: 'Saving…',

  // Feedback
  saved: 'Task saved',
  saveFailed: 'Could not save task',
  /** Shown in small grey text while entries are waiting to sync. */
  pending: (n: number) => `${n} pending`,
} as const;

/** Starting list, used until the Sheet's list has been loaded once. */
export const seedCompliments = ['So Cute', 'Cutie', 'Adorable', 'Precious', 'Baby Gorgeous'];

// PLACEHOLDER labels — edit freely. Values are written to the Sheet as-is.
export const genderOptions = ['Female', 'Male', 'Queer / Non-binary', 'Trans'];

export const raceOptions = [
  'Indian',
  'Asian',
  'Black',
  'Hispanic',
  'Middle Eastern',
  'Pacific Islander',
  'White',
];

export const ageOptions = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
