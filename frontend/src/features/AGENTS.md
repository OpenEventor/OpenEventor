# Features

## Convention

This directory holds complex, cross-page feature modules. Each feature gets its own subdirectory with:
- Feature component files (`.tsx`)
- `AGENTS.md` describing the feature

## When to create a feature

Use `features/` when a component:
- Appears on multiple pages
- Has significant business logic
- Contains multiple sub-components
- Needs its own state management

Simple, reusable UI controls go in `components/` instead.

## Current features
None yet. Planned:
- Import wizard (xlsx/csv competitor import)
- Results export (xlsx, PDF)
- Real-time feed (SSE consumer for live data)
