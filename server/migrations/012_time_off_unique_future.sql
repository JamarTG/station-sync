-- Prevent duplicate requests for the same day by the same user
ALTER TABLE time_off_requests
  ADD CONSTRAINT time_off_requests_user_date_unique UNIQUE (user_id, date);

-- Future-date enforcement is handled at the application layer in the Create handler.
