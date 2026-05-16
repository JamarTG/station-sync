ALTER TABLE fuel_receivals ADD CONSTRAINT fuel_receivals_shift_fuel_unique UNIQUE (shift_id, fuel_name);
