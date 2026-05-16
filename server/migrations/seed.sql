TRUNCATE nozzle_logs, tank_logs, deposits, shift_attendance, shift_fuel_prices, nozzles, tanks, shifts, shift_schedule_days, shift_schedules, pumps, users, fuels, days RESTART IDENTITY CASCADE;

INSERT INTO users (id, name, role, password_hash, active, phone, nis, trn, email, pay_rate, pay_type) VALUES
  ('f60f593a-28d2-4c17-9cd5-02c42c692574', 'John Smith', 'Supervisor', 'hash1', true, '555-0001', 'NIS001', 'TRN001', 'john@example.com', 1500.00, 'Hourly'),
  ('d99f5df6-8733-4ebd-ab7e-3e7ff9fea903', 'Jane Doe',   'Attendant',  'hash2', true, '555-0002', 'NIS002', 'TRN002', 'jane@example.com',  650.00, 'Hourly');

INSERT INTO fuels (id, name) VALUES
  ('5981a302-b8b4-4aa3-85cb-7c17b18479b5', 'ULSD'),
  ('2fea2e40-ec67-43b2-abe5-4027369d3ce5', 'ADO'),
  ('33c17355-eb9a-4372-9906-5d70976326fc', '87'),
  ('03e7bec2-568d-4ed2-afad-6d9cf1544067', '90');

INSERT INTO pumps (id, name, description) VALUES
  ('a2fb459c-578b-4d93-8f16-46e510f74df1', 'Pump 1', 'Front left'),
  ('a2675be3-5f88-4bc1-948a-7ef44ad63174', 'Pump 2', 'Front right');

INSERT INTO shifts (id, supervisor_id, date, start_time, end_time) VALUES
  ('e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 'f60f593a-28d2-4c17-9cd5-02c42c692574', '2026-04-29', '06:00:00', '14:00:00');

INSERT INTO nozzles (id, pump_id, fuel_id) VALUES
  ('c4f0394e-a66a-4c8a-8a61-177c61f91ac9', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '2fea2e40-ec67-43b2-abe5-4027369d3ce5'),
  ('d304bb36-151f-4994-9d9d-db79c3f7d73f', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '33c17355-eb9a-4372-9906-5d70976326fc'),
  ('87bdfe20-ad42-4c87-9355-b848308db783', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '03e7bec2-568d-4ed2-afad-6d9cf1544067'),
  ('6c6ebc9b-b879-4454-85bd-a0a1a99f932d', 'a2fb459c-578b-4d93-8f16-46e510f74df1', '5981a302-b8b4-4aa3-85cb-7c17b18479b5'),
  ('8a8c48e8-f54c-4cc4-90b3-e3294cc7e5f0', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '2fea2e40-ec67-43b2-abe5-4027369d3ce5'),
  ('f41c9f4f-fe25-43af-b117-53638d80e96d', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '33c17355-eb9a-4372-9906-5d70976326fc'),
  ('16ae4cae-f2b7-42dd-837c-075f5c2c8595', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '03e7bec2-568d-4ed2-afad-6d9cf1544067'),
  ('b0aa1d8d-b6e2-40a1-8079-772b0ec41a35', 'a2675be3-5f88-4bc1-948a-7ef44ad63174', '5981a302-b8b4-4aa3-85cb-7c17b18479b5');

INSERT INTO shift_fuel_prices (fuel_id, shift_id, price) VALUES
  ('2fea2e40-ec67-43b2-abe5-4027369d3ce5', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90),
  ('33c17355-eb9a-4372-9906-5d70976326fc', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90),
  ('03e7bec2-568d-4ed2-afad-6d9cf1544067', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90),
  ('5981a302-b8b4-4aa3-85cb-7c17b18479b5', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 190.90);

INSERT INTO nozzle_logs (id, nozzle_id, shift_id, starting_reading, ending_reading) VALUES
  ('cccf2c8f-5c42-4196-8c80-63add25a79a1', 'c4f0394e-a66a-4c8a-8a61-177c61f91ac9', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 1000.00, 1250.00),
  ('361144b8-f5d1-4dc3-80f3-02079b9bb55b', '6c6ebc9b-b879-4454-85bd-a0a1a99f932d', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d',  800.00, 1100.00),
  ('dd1defd1-1818-47f0-88bf-75bb45b96298', 'd304bb36-151f-4994-9d9d-db79c3f7d73f', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d',  500.00,  920.00),
  ('58d287d9-23e0-43c9-8399-95466658366c', '87bdfe20-ad42-4c87-9355-b848308db783', 'e4f148a2-3eaf-434b-9824-1ca06ebedd4d', 1500.00, 1680.00);
