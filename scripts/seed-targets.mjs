// Seeds the rv_targets pool with public-domain / CC Wikimedia Commons images.
// Idempotent: skips URLs that are already in the table. Each candidate URL is
// verified before insertion so dead links never enter the pool.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const file = (name, width = 900) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;

/** Each target carries ground-truth attribute tags for later sanity checks. */
const CANDIDATES = [
  { name: "All_Gizah_Pyramids.jpg", tags: { subject: "pyramids", colors: ["yellow", "brown"], environment: "outdoor", naturalManmade: "manmade", water: false, motion: "still", temperature: "hot" } },
  { name: "Tour_Eiffel_Wikimedia_Commons.jpg", tags: { subject: "tower", colors: ["grey", "blue"], environment: "outdoor", naturalManmade: "manmade", water: false, motion: "still", temperature: "neutral" } },
  { name: "GoldenGateBridge-001.jpg", tags: { subject: "bridge", colors: ["red", "blue"], environment: "outdoor", naturalManmade: "manmade", water: true, motion: "still", temperature: "cool" } },
  { name: "Hopetoun_falls.jpg", tags: { subject: "waterfall", colors: ["green", "white"], environment: "outdoor", naturalManmade: "natural", water: true, motion: "flowing", temperature: "cool" } },
  { name: "Polarlicht_2.jpg", tags: { subject: "aurora", colors: ["green", "black"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "flowing", temperature: "cold" } },
  { name: "Everest_kalapatthar.jpg", tags: { subject: "mountain", colors: ["white", "blue", "grey"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "cold" } },
  { name: "Fronalpstock_big.jpg", tags: { subject: "alpine panorama", colors: ["green", "blue", "white"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "cool" } },
  { name: "Moraine_Lake_17092005.jpg", tags: { subject: "mountain lake", colors: ["blue", "green", "grey"], environment: "outdoor", naturalManmade: "natural", water: true, motion: "still", temperature: "cold" } },
  { name: "Sydney_Opera_House_-_Dec_2008.jpg", tags: { subject: "opera house", colors: ["white", "blue"], environment: "outdoor", naturalManmade: "manmade", water: true, motion: "still", temperature: "warm" } },
  { name: "Pahoeoe_fountain_original.jpg", tags: { subject: "lava fountain", colors: ["red", "orange", "black"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "fast", temperature: "hot" } },
  { name: "NGC_4414_(NASA-med).jpg", tags: { subject: "galaxy", colors: ["white", "black", "brown"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "cold" } },
  { name: "Cat03.jpg", tags: { subject: "cat", colors: ["orange", "green", "white"], environment: "indoor", naturalManmade: "natural", water: false, motion: "still", temperature: "warm" } },
  { name: "Red_Apple.jpg", tags: { subject: "apple", colors: ["red", "green"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "neutral" } },
  { name: "African_Bush_Elephant.jpg", tags: { subject: "elephant", colors: ["grey", "green", "brown"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "slow", temperature: "hot" } },
  { name: "Lion_waiting_in_Namibia.jpg", tags: { subject: "lion", colors: ["brown", "yellow"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "hot" } },
  { name: "Fire_breathing_2_Luc_Viatour.jpg", tags: { subject: "fire breather", colors: ["orange", "red", "black"], environment: "outdoor", naturalManmade: "manmade", water: false, motion: "fast", temperature: "hot" } },
  { name: "Glühwendel_brennt_durch.jpg", tags: { subject: "light bulb filament", colors: ["orange", "yellow", "black"], environment: "indoor", naturalManmade: "manmade", water: false, motion: "still", temperature: "hot" } },
  { name: "Blue_Linckia_Starfish.JPG", tags: { subject: "starfish on reef", colors: ["blue", "brown"], environment: "outdoor", naturalManmade: "natural", water: true, motion: "still", temperature: "warm" } },
  { name: "Palace_of_Westminster,_London_-_Feb_2007.jpg", tags: { subject: "palace and river", colors: ["brown", "blue", "grey"], environment: "outdoor", naturalManmade: "manmade", water: true, motion: "still", temperature: "cool" } },
  { name: "Dszpics1.jpg", tags: { subject: "tornado", colors: ["grey", "black"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "chaotic", temperature: "cool" } },
  { name: "Canal_Grande_Chiesa_della_Salute_e_Dogana_dal_ponte_dell_Accademia.jpg", tags: { subject: "venice canal", colors: ["blue", "white", "brown"], environment: "outdoor", naturalManmade: "manmade", water: true, motion: "slow", temperature: "warm" } },
  { name: "USA_Antelope-Canyon.jpg", tags: { subject: "slot canyon", colors: ["orange", "red", "brown"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "warm" } },
  { name: "Schloss_Neuschwanstein_2013.jpg", tags: { subject: "castle", colors: ["white", "green", "grey"], environment: "outdoor", naturalManmade: "manmade", water: false, motion: "still", temperature: "cool" } },
  { name: "Sunflower_sky_backdrop.jpg", tags: { subject: "sunflower", colors: ["yellow", "blue", "green"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "warm" } },
  { name: "Machu_Picchu,_Peru.jpg", tags: { subject: "mountain ruins", colors: ["green", "grey"], environment: "outdoor", naturalManmade: "manmade", water: false, motion: "still", temperature: "cool" } },
  { name: "Sahara_satellite_hires.jpg", tags: { subject: "desert from space", colors: ["yellow", "brown", "blue"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "hot" } },
  { name: "Wheat_close-up.JPG", tags: { subject: "wheat", colors: ["yellow", "green"], environment: "outdoor", naturalManmade: "natural", water: false, motion: "still", temperature: "warm" } },
  { name: "Strokkur,_Iceland.jpg", tags: { subject: "geyser", colors: ["white", "blue", "brown"], environment: "outdoor", naturalManmade: "natural", water: true, motion: "fast", temperature: "cold" } },
  { name: "Times_Square,_New_York_City_(HDR).jpg", tags: { subject: "city square at night", colors: ["red", "blue", "yellow"], environment: "outdoor", naturalManmade: "manmade", water: false, motion: "busy", temperature: "neutral" } },
  { name: "Old_Faithfull-pdPhoto.jpg", tags: { subject: "geyser eruption", colors: ["white", "blue"], environment: "outdoor", naturalManmade: "natural", water: true, motion: "fast", temperature: "cold" } },
];

// Wikimedia requires a descriptive User-Agent and rate-limits anonymous clients.
const HEADERS = {
  "User-Agent": "PsiLab-Seeder/0.1 (https://psilab.vercel.app; https://github.com/DGator86/PsiLab)",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function verify(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow", headers: HEADERS });
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      return res.ok && type.startsWith("image/");
    } catch {
      await sleep(1000);
    }
  }
  return false;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("DATABASE_URL not set; skipping target seeding.");
    return;
  }
  const sql = neon(databaseUrl);

  const existing = await sql`select image_url from rv_targets`;
  const known = new Set(existing.map((r) => r.image_url));

  let inserted = 0;
  let skipped = 0;
  let dead = 0;
  for (const candidate of CANDIDATES) {
    const url = file(candidate.name);
    if (known.has(url)) {
      skipped++;
      continue;
    }
    await sleep(300);
    if (!(await verify(url))) {
      console.warn(`  dead link, skipping: ${candidate.name}`);
      dead++;
      continue;
    }
    await sql`
      insert into rv_targets (id, image_url, attribute_tags_json, active)
      values (${crypto.randomUUID()}, ${url}, ${JSON.stringify(candidate.tags)}, true)
    `;
    inserted++;
  }
  console.log(`rv_targets seed: ${inserted} inserted, ${skipped} already present, ${dead} dead links.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
