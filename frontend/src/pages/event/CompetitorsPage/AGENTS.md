# CompetitorsPage

## Purpose
Competitors management page. Displays DataGrid with competitor data. Currently shows empty grid with column definitions.

## File
- `CompetitorsPage.tsx`

## Route
`/events/:eventId/competitors` — default event sub-page (index redirect)

## Columns
bib, lastName, firstName, card, group, course

## Future
- Fetch competitors from `GET /api/events/:eventId/competitors`
- CRUD operations (add, edit, delete competitors)
- Inline editing in DataGrid
- Import from xlsx/csv

## Dependencies
- `@mui/x-data-grid` — DataGrid component
