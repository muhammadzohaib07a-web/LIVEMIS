import ExcelJS from "exceljs";

export type ExcelColumn = { header: string; key: string; width?: number };

const HEADER_FILL = "FF2563EB";
const HEADER_TEXT = "FFFFFFFF";
const BORDER_COLOR = "FFD1D5DB";

const thinBorder = (color: string) => ({
  top: { style: "thin" as const, color: { argb: color } },
  left: { style: "thin" as const, color: { argb: color } },
  bottom: { style: "thin" as const, color: { argb: color } },
  right: { style: "thin" as const, color: { argb: color } },
});

export async function downloadExcel(
  filename: string,
  columns: ExcelColumn[],
  rows: Record<string, string>[],
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tickets");
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
  sheet.addRows(rows);
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder(HEADER_FILL);
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = thinBorder(BORDER_COLOR);
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
