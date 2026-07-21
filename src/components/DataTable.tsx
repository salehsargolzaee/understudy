import { useMemo } from "react";
import Papa from "papaparse";
import type { DataFile } from "../content";

function CsvTable({ file }: { file: DataFile }) {
  const { header, rows } = useMemo(() => {
    const out = Papa.parse<string[]>(file.contents.trim(), { skipEmptyLines: true });
    const data = (out.data as string[][]).filter((r) => r.length && r.some((c) => c !== ""));
    return { header: data[0] ?? [], rows: data.slice(1) };
  }, [file.contents]);

  return (
    <div>
      <code className="mb-2 block font-mono text-xs text-ink-950">data/{file.name}</code>
      <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-ink-900/[0.03]">
            <tr>
              {header.map((h, i) => (
                <th
                  key={i}
                  className="border-b border-ink-900/10 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-700 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {header.map((_, ci) => (
                  <td
                    key={ci}
                    className="border-b border-ink-900/[0.06] px-3 py-1.5 font-mono text-[13px] tabular-nums text-ink-800 whitespace-nowrap"
                  >
                    {r[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DataTable({ files }: { files: DataFile[] }) {
  const csvs = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));
  if (!csvs.length) return null;
  return (
    <section className="mt-8 border-t border-ink-900/10 pt-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-700">Provided data</h2>
      <div className="space-y-6">
        {csvs.map((f) => (
          <CsvTable key={f.name} file={f} />
        ))}
      </div>
    </section>
  );
}
