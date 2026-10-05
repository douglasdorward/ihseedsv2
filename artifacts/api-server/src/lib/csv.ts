/** Minimal RFC 4180 style CSV reader shared by the admin CSV imports. */
export function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === "\"" && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        current += character;
      }
      continue;
    }
    if (character === "\"") {
      quoted = true;
      continue;
    }
    if (character === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current);
  return cells;
}

export function parseCsv(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  return lines.map(parseCsvLine);
}
