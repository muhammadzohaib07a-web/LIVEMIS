export const EMPLOYEE_DEPARTMENTS = [
  "Accounts",
  "Inventory",
  "Quality",
  "Production",
  "Warehouse",
] as const;

export const MIS_DEPARTMENT = "MIS";

export type EmployeeDepartment = (typeof EMPLOYEE_DEPARTMENTS)[number];
