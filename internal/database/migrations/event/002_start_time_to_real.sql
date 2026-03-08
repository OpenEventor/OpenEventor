-- Convert start_time from TEXT to REAL (unix seconds).
-- Existing string values are zeroed out; SQLite is dynamically typed.
UPDATE competitors SET start_time = 0;
UPDATE groups SET start_time = 0;
UPDATE courses SET start_time = 0;
