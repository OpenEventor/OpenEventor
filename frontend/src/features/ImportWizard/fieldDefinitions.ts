import type { ImportFieldDef } from '../../api/types';

/** Fields available for competitor import mapping. */
export const COMPETITOR_FIELDS: ImportFieldDef[] = [
  { field: 'bib', label: 'Bib' },
  { field: 'lastName', label: 'Last Name' },
  { field: 'firstName', label: 'First Name' },
  { field: 'middleName', label: 'Middle Name' },
  { field: 'lastNameInt', label: 'Last Name (Int)' },
  { field: 'firstNameInt', label: 'First Name (Int)' },
  { field: 'card1', label: 'Card 1' },
  { field: 'card2', label: 'Card 2' },
  { field: 'gender', label: 'Gender' },
  { field: 'birthDate', label: 'Birth Date' },
  { field: 'birthYear', label: 'Birth Year' },
  { field: 'rank', label: 'Rank' },
  { field: 'rating', label: 'Rating' },
  { field: 'country', label: 'Country' },
  { field: 'region', label: 'Region' },
  { field: 'city', label: 'City' },
  { field: 'phone', label: 'Phone' },
  { field: 'email', label: 'Email' },
  { field: 'startTime', label: 'Start Time' },
  { field: 'timeAdjustment', label: 'Time Adjustment' },
  { field: 'entryNumber', label: 'Entry Number' },
  { field: 'price', label: 'Price' },
  { field: 'notes', label: 'Notes' },
  { field: 'groupId', label: 'Group' },
  { field: 'courseId', label: 'Course' },
  { field: 'teamId', label: 'Team' },
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
