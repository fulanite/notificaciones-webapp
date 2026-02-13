-- Add username column to usuarios table
ALTER TABLE usuarios ADD COLUMN username VARCHAR(50) UNIQUE AFTER email;

-- Pre-populate usernames for existing ujieres (optional, but requested pattern)
-- Example: update ujieres to have username 'ujier' + last part of their ID or a counter
-- But it's better to let the admin set them. 
-- However, I can do a basic mapping if desired.
