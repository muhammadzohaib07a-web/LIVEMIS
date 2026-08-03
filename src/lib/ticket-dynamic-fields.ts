// Module-specific follow-up questions shown once a category is picked, so
// MIS gets the exact reference info it needs to investigate (Odoo document
// numbers, work centers, looms, etc.) instead of a single free-text box.
export type DynamicFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
};

const MODULE_FIELD_MAP: Record<string, DynamicFieldDef[]> = {
  "odoo-inventory": [
    { key: "warehouse", label: "Warehouse / Location" },
    { key: "lot_serial", label: "Lot / Serial Number" },
    { key: "reference_no", label: "Transfer / Picking Number" },
  ],
  "odoo-warehouse": [
    { key: "warehouse", label: "Warehouse / Location" },
    { key: "reference_no", label: "Delivery / Receipt Number" },
  ],
  "odoo-manufacturing": [
    { key: "reference_no", label: "Manufacturing Order Number" },
    { key: "work_center", label: "Work Center / Machine" },
    { key: "batch_no", label: "Batch Number" },
  ],
  "odoo-quality": [
    { key: "reference_no", label: "Work Order Number" },
    { key: "product", label: "Product / Lot" },
  ],
  "odoo-sales": [
    { key: "customer", label: "Customer Name" },
    { key: "reference_no", label: "Quotation / Sales Order Number" },
  ],
  "odoo-purchase": [
    { key: "vendor", label: "Vendor Name" },
    { key: "reference_no", label: "RFQ / Purchase Order Number" },
  ],
  "odoo-accounting": [{ key: "reference_no", label: "Invoice / Journal Reference" }],
  "textile-weaving": [
    { key: "machine", label: "Loom Number" },
    { key: "shift", label: "Shift" },
  ],
  "textile-dyeing": [
    { key: "batch_no", label: "Batch Number" },
    { key: "reference_no", label: "Shade Code" },
  ],
  "textile-finishing": [{ key: "reference_no", label: "Lot Number" }],
  "textile-planning": [{ key: "work_center", label: "Work Center" }],
  "textile-costing": [{ key: "reference_no", label: "Order Number" }],
};

export function getModuleFields(category: string): DynamicFieldDef[] {
  return MODULE_FIELD_MAP[category] ?? [];
}

export type TicketMetadata = {
  errorMessage?: string;
  workStopped?: boolean;
  affectedUsers?: number;
  [key: string]: string | number | boolean | undefined;
};

export const METADATA_FIELD_LABELS: Record<string, string> = {
  errorMessage: "Error Message",
  workStopped: "Work Stopped",
  affectedUsers: "Affected Users",
  warehouse: "Warehouse / Location",
  lot_serial: "Lot / Serial Number",
  reference_no: "Reference Number",
  work_center: "Work Center / Machine",
  batch_no: "Batch Number",
  product: "Product / Lot",
  customer: "Customer Name",
  vendor: "Vendor Name",
  machine: "Loom Number",
  shift: "Shift",
};
