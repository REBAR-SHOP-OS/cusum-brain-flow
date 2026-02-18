const DIM_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

export interface ZplRowData {
  mark: string;
  size: string;
  grade: string;
  qty: number | null;
  total_length_mm: number | null;
  weight: string;
  dwg: string;
  row_index: number | string;
  reference: string;
  dims: Record<string, number | null>;
}

function sanitizeZpl(value: string): string {
  // Remove ZPL control characters that could break commands
  return value.replace(/[\^~]/g, "").trim();
}

function buildDimLines(dims: Record<string, number | null>): string {
  const activeDims = DIM_COLS.filter((d) => dims[d] != null && dims[d] !== 0);
  if (activeDims.length === 0) return "";

  const lines: string[] = [];
  for (let i = 0; i < activeDims.length; i += 4) {
    const chunk = activeDims.slice(i, i + 4);
    const y = 565 + Math.floor(i / 4) * 55;
    const text = chunk.map((d) => `${d}:${dims[d]}`).join("  ");
    lines.push(`^CF0,38\n^FO25,${y}^FD${text}^FS`);
  }
  return lines.join("\n");
}

export function generateZpl(rows: ZplRowData[], sessionName: string): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");

  const labels = rows.map((row) => {
    const mark = sanitizeZpl(row.mark || "—");
    const size = sanitizeZpl(row.size || "—");
    const grade = sanitizeZpl(row.grade || "—");
    const qty = row.qty != null ? String(row.qty) : "—";
    const length = row.total_length_mm != null ? `${row.total_length_mm}` : "—";
    const weight = row.weight ? `${row.weight} kg` : "—";
    const dwg = sanitizeZpl(row.dwg || "—");
    const item = String(row.row_index ?? "—");
    const reference = sanitizeZpl(row.reference || "");
    const dimLines = buildDimLines(row.dims);

    return `^XA
^PW812
^LL1218
^CI28
^MMT

^CF0,55
^FO25,28^FDMARK^FS
^CF0,95
^FO25,78^FD${mark}^FS

^CF0,55
^FO310,28^FDSIZE^FS
^CF0,95
^FO310,78^FD${size}^FS

^CF0,55
^FO560,28^FDGRADE^FS
^CF0,95
^FO560,78^FD${grade}^FS

^FO25,190^GB762,3,3^FS

^CF0,48
^FO25,205^FDQTY:^FS
^CF0,75
^FO25,250^FD${qty}^FS

^CF0,48
^FO310,205^FDLENGTH (mm):^FS
^CF0,75
^FO310,250^FD${length}^FS

^FO25,345^GB762,3,3^FS

^CF0,48
^FO25,360^FDWEIGHT:^FS
^CF0,75
^FO25,405^FD${weight}^FS

^FO25,500^GB762,3,3^FS

^CF0,40
^FO25,515^FDDIMS:^FS
${dimLines}

^FO25,680^GB762,3,3^FS

^BY3,3,100
^FO200,700^BC,,Y,N^FD${mark}^FS

^FO25,860^GB762,3,3^FS

^CF0,45
^FO25,878^FDDWG: ${dwg}   ITEM: ${item}^FS
^CF0,45
^FO25,933^FDREF: ${reference}^FS

^FO25,1000^GB762,3,3^FS

^CF0,34
^FO25,1018^FDREBAR.SHOP OS^FS
^CF0,34
^FO490,1018^FD${timestamp}^FS

^XZ`;
  });

  return labels.join("\n\n");
}
