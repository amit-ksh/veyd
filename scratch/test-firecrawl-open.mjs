import fs from "fs";

if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function testFirecrawl() {
  console.log("=== TESTING OPEN WEBCRAWL SEARCH ===");
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("FIRECRAWL_API_KEY missing");
    process.exit(1);
  }

  const query = "OSHA respiratory protection standard 1910.134 requirements";
  console.log(`Searching query: "${query}" across open web...`);

  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 3,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  console.log(`Firecrawl response status: ${res.status}`);
  if (!res.ok) {
    const err = await res.text();
    console.error("Error:", err);
    return;
  }

  const json = await res.json();
  const results = json.data || [];
  console.log(`Found ${results.length} results from open web:`);
  for (const r of results) {
    const url = r.url || "";
    const domain = new URL(url).hostname;
    const isGov = domain.endsWith(".gov") || domain.endsWith(".europa.eu");
    console.log(` - [${isGov ? "OFFICIAL-WEB" : "SECONDARY-WEB"}] ${r.title} (${domain})`);
  }
  console.log("✓ Open web search without domain restriction working as requested!");
}

testFirecrawl().catch(console.error);
