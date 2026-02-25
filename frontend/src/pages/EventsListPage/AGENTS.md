# EventsListPage

## Purpose
Displays list of events the current user has access to. Supports creating and deleting events.

## Files
- `EventsListPage.tsx` — Main page component with MUI Table
- `CreateEventDialog.tsx` — Dialog for creating new events

## Route
`/events` — protected (inside ProtectedRoute)

## Features
- Fetches events from `GET /api/events`
- MUI Table with columns: Name, Date, Created, Actions
- Click on row navigates to `/events/:eventId/competitors`
- "Create Event" button opens CreateEventDialog → `POST /api/events`
- Actions column: DropDownMenu with Download (disabled) and Delete event
- Delete requires typing event name to confirm (DropDownMenuPrompt)
- Loading skeleton, error alert with Retry, empty state

## Dependencies
- `api/client.ts` — API requests
- `api/types.ts` — EventItem type
- `components/DropDownMenu/` — DropDownMenu, DropDownMenuPrompt
