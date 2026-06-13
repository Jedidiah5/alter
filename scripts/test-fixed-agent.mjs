import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";

const PDF_TEXT = `
Apple Inc. Q4 FY24 Earnings Summary
Total Revenue: $94,930 million (+6.1% vs Q4 FY23 $89,498M)
Products Revenue: $69,958 million
Services Revenue: $24,972 million
Gross Margin: 46.2%
Operating Income: $29,590 million
Net Income: $14,736 million
iPhone Revenue: $46,223 million
Mac Revenue: $7,744 million
iPad Revenue: $6,950 million
Wearables Revenue: $9,042 million
Americas: $41,664M | Europe: $24,924M | Greater China: $15,033M | Japan: $5,806M | Rest of Asia Pacific: $7,503M
`.trim();

const input = {
  thread_id: randomUUID(),
  run_id: randomUUID(),
  state: {},
  messages: [
    {
      id: randomUUID(),
      role: "user",
      content: "Render the dashboard.",
      input: [
        { type: "text", text: "Render the dashboard." },
        {
          type: "data",
          value: PDF_TEXT,
          mimeType: "text/plain",
        },
      ],
    },
  ],
  tools: [],
  context: [],
  forwarded_props: {},
};

const res = await fetch("http://localhost:8123/fixed", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
  body: JSON.stringify(input),
});

console.log("status:", res.status, res.statusText);
if (!res.ok || !res.body) {
  console.log(await res.text());
  process.exit(1);
}

const events = [];
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() ?? "";
  for (const part of parts) {
    for (const line of part.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          /* ignore */
        }
      }
    }
  }
}

const types = [...new Set(events.map((e) => e.type))];
const activity = events.filter((e) => String(e.type).includes("ACTIVITY"));
const toolCalls = events.filter((e) => String(e.type).includes("TOOL"));
const errors = events.filter(
  (e) => String(e.type).includes("ERROR") || String(e.type).includes("RUN_ERROR"),
);

console.log("total events:", events.length);
console.log("event types:", types.join(", "));
console.log("activity events:", activity.length);
console.log("tool events:", toolCalls.length);
console.log("error events:", errors.length);
if (errors.length) console.log("errors:", JSON.stringify(errors, null, 2));
if (activity.length) {
  console.log(
    "sample activity:",
    JSON.stringify(activity[0], null, 2).slice(0, 1000),
  );
}

process.exit(activity.length > 0 && errors.length === 0 ? 0 : 1);
