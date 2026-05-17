TRUNCATE
  tank_logs, nozzle_logs, deposits, shift_attendance, shift_fuel_prices,
  nozzles, tanks, shifts, pumps, sessions, users, fuels, branches, businesses
  RESTART IDENTITY CASCADE;

-- All passwords: "password"
INSERT INTO businesses (id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Shell Portmore');

INSERT INTO branches (id, business_id, name) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Main Branch');

INSERT INTO users (id, business_id, branch_id, name, role, password_hash, active, phone, nis, trn, email) VALUES
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'A. Lewis',    'Supervisor', '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0001', 'NIS001', 'TRN001', 'alewis@station.com'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'S. Lawes',    'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0002', 'NIS002', 'TRN002', 'slawes@station.com'),
  ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'S. Smith',    'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0003', 'NIS003', 'TRN003', 'ssmith@station.com'),
  ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'T. Brisco',   'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0004', 'NIS004', 'TRN004', 'tbrisco@station.com'),
  ('11111111-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'M. Brown',    'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0005', 'NIS005', 'TRN005', 'mbrown@station.com'),
  ('11111111-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'D. Johnson',  'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0006', 'NIS006', 'TRN006', 'djohnson@station.com'),
  ('11111111-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'A. Clarke',   'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0007', 'NIS007', 'TRN007', 'aclarke@station.com'),
  ('11111111-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'R. Thompson', 'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0008', 'NIS008', 'TRN008', 'rthompson@station.com'),
  ('11111111-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'K. Williams', 'Attendant',  '$2a$10$Jf3mMZ14lGFZdZubVsxLquUOElhDL6dboIzhgHWVkXb/IqTqTkO9m', true, '555-0009', 'NIS009', 'TRN009', 'kwilliams@station.com');

INSERT INTO fuels (id, business_id, name) VALUES
  ('5981a302-b8b4-4aa3-85cb-7c17b18479b5', 'aaaaaaaa-0000-0000-0000-000000000001', 'ULSD'),
  ('2fea2e40-ec67-43b2-abe5-4027369d3ce5', 'aaaaaaaa-0000-0000-0000-000000000001', 'ADO'),
  ('33c17355-eb9a-4372-9906-5d70976326fc', 'aaaaaaaa-0000-0000-0000-000000000001', '87'),
  ('03e7bec2-568d-4ed2-afad-6d9cf1544067', 'aaaaaaaa-0000-0000-0000-000000000001', '90');

INSERT INTO pumps (id, business_id, branch_id, name, description) VALUES
  ('a2fb459c-578b-4d93-8f16-46e510f74df1', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pump 1', 'Bay 1 left'),
  ('a2675be3-5f88-4bc1-948a-7ef44ad63174', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pump 2', 'Bay 1 right'),
  ('b3786ce4-6a99-4cd2-8a9b-8fb55be74285', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pump 3', 'Bay 2 left'),
  ('c4897df5-7b00-4de3-9b0c-9ec66cf85396', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pump 4', 'Bay 2 right'),
  ('d5908ef6-8c11-4ef4-ab1d-0ad77de964a7', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pump 5', 'Bay 3 left'),
  ('e6019ff7-9d22-4fa5-b82e-1be88ef07518', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Pump 6', 'Bay 3 right');

INSERT INTO nozzles (id, pump_id, fuel_id) VALUES
  ('c4f0394e-a66a-4c8a-8a61-177c61f91ac9', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '2fea2e40-ec67-43b2-abe5-4027369d3ce5'),
  ('d304bb36-151f-4994-9d9d-db79c3f7d73f', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '33c17355-eb9a-4372-9906-5d70976326fc'),
  ('87bdfe20-ad42-4c87-9355-b848308db783', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '03e7bec2-568d-4ed2-afad-6d9cf1544067'),
  ('6c6ebc9b-b879-4454-85bd-a0a1a99f932d', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '5981a302-b8b4-4aa3-85cb-7c17b18479b5'),
  ('8a8c48e8-f54c-4cc4-90b3-e3294cc7e5f0', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '2fea2e40-ec67-43b2-abe5-4027369d3ce5'),
  ('f41c9f4f-fe25-43af-b117-53638d80e96d', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '33c17355-eb9a-4372-9906-5d70976326fc'),
  ('16ae4cae-f2b7-42dd-837c-075f5c2c8595', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '03e7bec2-568d-4ed2-afad-6d9cf1544067'),
  ('b0aa1d8d-b6e2-40a1-8079-772b0ec41a35', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '5981a302-b8b4-4aa3-85cb-7c17b18479b5');

INSERT INTO shifts (id, business_id, branch_id, supervisor_id, date, start_time) VALUES
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', CURRENT_DATE, '06:00:00');

INSERT INTO shift_attendance (shift_id, user_id, clock_in, pump_id) VALUES
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', '11111111-0000-0000-0000-000000000002', NOW() - INTERVAL '4 hours', 'a2fb459c-578b-4d93-8f16-46e510f74df1'),
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', '11111111-0000-0000-0000-000000000003', NOW() - INTERVAL '4 hours', 'a2675be3-5f88-4bc1-948a-7ef44ad63174'),
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', '11111111-0000-0000-0000-000000000004', NOW() - INTERVAL '4 hours', 'b3786ce4-6a99-4cd2-8a9b-8fb55be74285');

INSERT INTO shift_fuel_prices (fuel_id, shift_id, price) VALUES
  ('5981a302-b8b4-4aa3-85cb-7c17b18479b5', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90),
  ('2fea2e40-ec67-43b2-abe5-4027369d3ce5', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90),
  ('33c17355-eb9a-4372-9906-5d70976326fc', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90),
  ('03e7bec2-568d-4ed2-afad-6d9cf1544067', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90);

INSERT INTO deposits (shift_id, attendant_id, type, amount, metadata) VALUES
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', '11111111-0000-0000-0000-000000000002', 'Cash',   150000.0, '{"supervisor":"A. Lewis","denominations":{"5000":25,"2000":10,"1000":5}}'),
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', '11111111-0000-0000-0000-000000000003', 'Cash',    92000.0, '{"supervisor":"A. Lewis","denominations":{"5000":15,"2000":10,"1000":7}}'),
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', '11111111-0000-0000-0000-000000000004', 'Charge',   8608.08, '{"fuel_type":"87","litres":45.2}'),
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', '11111111-0000-0000-0000-000000000003', 'FX',      75000.0, '{"fx_amount":500,"currency":"USD"}');
