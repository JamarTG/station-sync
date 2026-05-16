ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_type_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_type_check
  CHECK (type IN ('Cash','Card','Charge','FX','Advance','Expenditure','CashDeposit','Cheque','CardDeposit','FXDeposit'));
