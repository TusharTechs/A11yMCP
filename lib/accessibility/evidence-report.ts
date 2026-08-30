export function downloadEvidenceReport(report: unknown): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "a11ymcp-evidence-report.json";
  anchor.click();
  URL.revokeObjectURL(url);
}