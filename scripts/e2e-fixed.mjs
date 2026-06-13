import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Minimal valid PDF with extractable text
const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 120 >>stream
BT /F1 12 Tf 72 720 Td (Apple Q4 FY24 Revenue 94930M up 6.1 percent) Tj ET
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000264 00000 n 
0000000436 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
514
%%EOF`;

const pdfPath = join(process.cwd(), "scripts", "sample-earnings.pdf");
writeFileSync(pdfPath, pdf);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
const networkErrors = [];
const sseEvents = [];

page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));
page.on("response", (res) => {
  if (res.status() >= 400) networkErrors.push(`${res.status()} ${res.url()}`);
});
page.on("requestfinished", async (req) => {
  const url = req.url();
  if (url.includes("/api/copilotkit") || url.includes(":8123/fixed")) {
    try {
      const res = await req.response();
      const ct = res?.headers()["content-type"] ?? "";
      if (ct.includes("event-stream") && res) {
        const body = await res.text().catch(() => "");
        for (const line of body.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const ev = JSON.parse(line.slice(6));
              sseEvents.push(`${ev.type}`);
            } catch {}
          }
        }
      }
    } catch {}
  }
});

await page.goto("http://localhost:3000/fixed", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const fileInput = page.locator('input[type="file"]');
if ((await fileInput.count()) === 0) {
  console.log("FAIL: no file input found");
  await browser.close();
  process.exit(1);
}

await fileInput.setInputFiles(pdfPath);
await page.waitForTimeout(1500);

const loadedBanner = page.getByText(/loaded/i);
console.log("loaded banner visible:", await loadedBanner.isVisible().catch(() => false));

const chatInput = page.locator("textarea, [contenteditable=true]").last();
await chatInput.fill("Render the dashboard.");
await chatInput.press("Enter");

await page.waitForTimeout(45000);

const canvasEmpty = page.getByText("Canvas is empty");
const canvasStillEmpty = await canvasEmpty.isVisible().catch(() => false);
const hasSurface = await page.locator(".a2ui-surface, [data-surface-id]").count();
const activityTypes = [...new Set(sseEvents.filter((t) => t.includes("ACTIVITY")))];

console.log("canvas still empty:", canvasStillEmpty);
console.log("a2ui surface elements:", hasSurface);
console.log("sse activity types:", activityTypes.join(", ") || "(none)");
console.log("network errors:", networkErrors.slice(0, 5).join("; ") || "(none)");
console.log("recent console:", logs.slice(-8).join("\n"));

await browser.close();
process.exit(hasSurface > 0 ? 0 : 1);
