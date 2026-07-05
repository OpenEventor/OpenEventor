import type { ImportFieldDef } from '../../api/types';

/**
 * Fields available for competitor import mapping.
 * `label` holds an i18n key resolved at the render site with `t(label)` — the
 * `field` identifiers are the stable keys used for CSV column matching and the
 * import API, and must not change.
 */
export const COMPETITOR_FIELDS: ImportFieldDef[] = [
  { field: 'bib', label: 'import.fields.bib' },
  { field: 'lastName', label: 'import.fields.lastName' },
  { field: 'firstName', label: 'import.fields.firstName' },
  { field: 'middleName', label: 'import.fields.middleName' },
  { field: 'lastNameInt', label: 'import.fields.lastNameInt' },
  { field: 'firstNameInt', label: 'import.fields.firstNameInt' },
  { field: 'card1', label: 'import.fields.card1' },
  { field: 'card2', label: 'import.fields.card2' },
  { field: 'gender', label: 'import.fields.gender' },
  { field: 'birthDate', label: 'import.fields.birthDate' },
  { field: 'birthYear', label: 'import.fields.birthYear' },
  { field: 'rank', label: 'import.fields.rank' },
  { field: 'rating', label: 'import.fields.rating' },
  { field: 'country', label: 'import.fields.country' },
  { field: 'region', label: 'import.fields.region' },
  { field: 'city', label: 'import.fields.city' },
  { field: 'phone', label: 'import.fields.phone' },
  { field: 'email', label: 'import.fields.email' },
  { field: 'startTime', label: 'import.fields.startTime' },
  { field: 'timeAdjustment', label: 'import.fields.timeAdjustment' },
  { field: 'entryNumber', label: 'import.fields.entryNumber' },
  { field: 'price', label: 'import.fields.price' },
  { field: 'notes', label: 'import.fields.notes' },
  { field: 'groupId', label: 'import.fields.groupId' },
  { field: 'courseId', label: 'import.fields.courseId' },
  { field: 'teamId', label: 'import.fields.teamId' },
];

/** Aliases for auto-detection: lowercase alias → field name. */
export const FIELD_ALIASES: Record<string, string> = {
  // Bib
  'bib': 'bib',
  'number': 'bib',
  'num': 'bib',
  'no': 'bib',
  'no.': 'bib',
  '#': 'bib',
  'номер': 'bib',
  'стартовый номер': 'bib',

  // Names
  'last name': 'lastName',
  'lastname': 'lastName',
  'surname': 'lastName',
  'family name': 'lastName',
  'фамилия': 'lastName',

  'first name': 'firstName',
  'firstname': 'firstName',
  'name': 'firstName',
  'given name': 'firstName',
  'имя': 'firstName',

  'middle name': 'middleName',
  'middlename': 'middleName',
  'patronymic': 'middleName',
  'отчество': 'middleName',

  // Cards
  'card': 'card1',
  'card1': 'card1',
  'card 1': 'card1',
  'chip': 'card1',
  'si': 'card1',
  'чип': 'card1',

  'card2': 'card2',
  'card 2': 'card2',

  // Gender
  'gender': 'gender',
  'sex': 'gender',
  'пол': 'gender',

  // Birth
  'birth date': 'birthDate',
  'birthdate': 'birthDate',
  'date of birth': 'birthDate',
  'dob': 'birthDate',
  'дата рождения': 'birthDate',

  'birth year': 'birthYear',
  'birthyear': 'birthYear',
  'year': 'birthYear',
  'year of birth': 'birthYear',
  'год рождения': 'birthYear',
  'г.р.': 'birthYear',

  // Location
  'country': 'country',
  'страна': 'country',
  'region': 'region',
  'регион': 'region',
  'область': 'region',
  'city': 'city',
  'город': 'city',

  // Contact
  'phone': 'phone',
  'tel': 'phone',
  'telephone': 'phone',
  'телефон': 'phone',
  'email': 'email',
  'e-mail': 'email',

  // Rank/Rating
  'rank': 'rank',
  'разряд': 'rank',
  'звание': 'rank',
  'rating': 'rating',
  'рейтинг': 'rating',

  // Other
  'start time': 'startTime',
  'start': 'startTime',
  'время старта': 'startTime',
  'entry': 'entryNumber',
  'entry number': 'entryNumber',
  'price': 'price',
  'цена': 'price',
  'стоимость': 'price',
  'notes': 'notes',
  'comment': 'notes',
  'comments': 'notes',
  'примечание': 'notes',
  'комментарий': 'notes',

  'group': 'groupId',
  'группа': 'groupId',
  'course': 'courseId',
  'дистанция': 'courseId',
  'team': 'teamId',
  'club': 'teamId',
  'команда': 'teamId',
  'клуб': 'teamId',
  'организация': 'teamId',
};

/**
 * Auto-detect column→field mapping from the first row values.
 * Returns a mapping of column index (string) → field name.
 */
export function autoDetectMapping(headerRow: string[], fields: ImportFieldDef[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();
  const availableFields = new Set(fields.map((f) => f.field));

  for (let i = 0; i < headerRow.length; i++) {
    const raw = headerRow[i].trim().toLowerCase();
    if (!raw) continue;

    const field = FIELD_ALIASES[raw];
    if (field && availableFields.has(field) && !usedFields.has(field)) {
      mapping[String(i)] = field;
      usedFields.add(field);
    }
  }

  return mapping;
}
