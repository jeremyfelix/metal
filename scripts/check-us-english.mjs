// Greps the text fields we wrote (artist blurbs, release notes/dateNotes, event titles/descriptions)
// for common British spellings and vocabulary. Exit 1 on any hit that is not allowlisted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const artists = load("artists.json"), releases = load("releases.json"), events = load("events.json");
const playlists = fs.existsSync(path.join(root, "data/playlists.json")) ? load("playlists.json") : [];

const PATTERNS = [
  /\b\w*(?:colour|favour|honour|behaviour|labour|neighbour|rumour|humour|harbour|vigour|flavour)\w*\b/gi,
  /\b\w+(?:ise|ised|ises|ising|isation|isations)\b/gi,
  /\b\w*(?:yse|ysed|ysing)\b/gi,
  /\b\w*(?:centre|metre|theatre|litre|fibre|sombre|calibre|spectre)s?\b/gi,
  /\b(?:defence|offence|licence|pretence|practise|practised|grey|greys|plough|tyre|tyres|kerb|jewellery|cheque|catalogue|dialogue|analogue|programme|programmes|sceptic\w*|storey|mould|moulded|draught|aluminium|manoeuvre\w*|artefact\w*|ageing|enrol|enrolment|fulfil|fulfilment|skilful|wilful|instalment|judgement|acknowledgement|towards|whilst|amongst|amidst|learnt|spelt|burnt|dreamt|spoilt|leapt|fortnight|lorry|lorries|flat|lift|petrol|holiday|mum|telly|biscuit|motorway|pavement|rubbish|queue|queued|queueing|autumn|cinema|film|maths|football|anticlockwise|tarmac|bonnet|boot|windscreen|takeaway|council estate|jumper|trainers|nappy|pub)\b/gi,
  /\b(?:travell\w+|cancell\w+|modell\w+|labell\w+|signall\w+|counsell\w+|fuell\w+|marvell\w+|levell\w+|rivall\w+|totall\w+|dialled|equall\w+)\b/gi,
  /\b(?:in hospital|at weekends|at the weekend|in future|at university|in the post|to hospital|get on with|sort out|round the world|full stop|at the moment)\b/gi,
  /\b(?:the band|the group|the trio|the duo|the label|the pair|the quartet|the quintet) (?:were|have|are|do|their members have)\b/gi,
  /\b(?:Metallica|Slayer|Anthrax|Megadeth|Exodus|Testament|Overkill|Kreator|Sodom|Destruction|Sepultura|Venom|Saxon|Motörhead|Pantera|Death|Possessed|Raven|Napalm Death|Carcass|Entombed|Mayhem|Bathory|Hellhammer|Dio|Cream|Rainbow|Kiss|Rush|Voivod|Annihilator|Coroner|Deicide|Obituary|Cannibal Corpse|Iron Maiden|Judas Priest|Black Sabbath|Led Zeppelin|Deep Purple|Thin Lizzy|Def Leppard|Black Flag|Dead Kennedys|Bad Brains|Ramones|Misfits|Mötley Crüe|AC\/DC|Van Halen|Hawkwind|Budgie|Sabbat|Tankard|Onslaught|Artillery|Razor|Whiplash|Heathen|Forbidden|Helloween|Accept|Scorpions|Manowar|Anvil|Exciter|Girlschool|Tank|UFO|MC5|Cro-Mags|Atheist|Autopsy|Repulsion|Terrorizer|Sarcófago|Celtic Frost|Mercyful Fate|Discharge|Diamond Head|Angel Witch|Dark Angel|Death Angel|Nuclear Assault|Vio-lence|Sacred Reich|Flotsam and Jetsam|Metal Church|Morbid Angel|Bolt Thrower|Corrosion of Conformity|Agnostic Front|Minor Threat|Suicidal Tendencies|D\.R\.I\.|G\.B\.H\.|Guns N' Roses|Alice Cooper|Blue Cheer|Blue Öyster Cult|Uriah Heep|King Diamond|Tygers of Pan Tang|Sex Pistols|The Exploited|The Stooges|The Who|Cream|Earache|Roadrunner|Noise|Combat|Megaforce|Metal Blade) (?:were|have|are|do|haven't|aren't)\b/g,
];
// Words that matched a pattern but are fine (proper nouns, US spellings, titles).
const ALLOW = new Set([
  "film","films","cinema","flat","lift","boot","pub","holiday","autumn","catalogue","dialogue",
  "promise","premise","raise","rise","arise","otherwise","precise","noise","Noise","praise","surprise","advertise","exercise","expertise","revise","devise","comprise","enterprise","wise","likewise","Elise","paradise","Paradise","franchise","compromise","disguise","demise","cruise","bruise","poise","treatise","merchandise","supervise","televise","promised","raised","arisen","surprised","disguised","compromised","comprised","revised","advertised","exercised","supervised","televised","franchised","rising","praising","raising","promising","surprising","arising","advertising","exercising","revising","disguising","compromising","noises","raises","rises","comprises","exercises","premises","promises","franchises","surprises","wiser","wisest","Wise","apprise","chastise","despise","improvise","improvised","improvising","incise","excise","concise","expertise","Denise","Louise","Maurice","Elise","Eurise","Cruise",
  "Metal Blade are","analyze",
]);

const fields = [];
for (const p of playlists) { fields.push([`playlist ${p.id}.title`, p.title]); fields.push([`playlist ${p.id}.description`, p.description]); for (const it of p.items) fields.push([`playlist ${p.id}.${it.releaseId}`, it.note]); }
for (const a of artists) fields.push([`artist ${a.id}.blurb`, a.blurb]);
for (const r of releases) { fields.push([`release ${r.id}.note`, r.note]); fields.push([`release ${r.id}.dateNote`, r.dateNote]); }
for (const e of events) { fields.push([`event ${e.id}.title`, e.title]); fields.push([`event ${e.id}.description`, e.description]); }

// Per-hit allowlist for proper nouns / titles: "<field-id>:<matched text>" or just matched text lowercased.
const ALLOW_HITS = new Set((fs.existsSync(path.join(root, "scripts/us-english-allow.json")) ? JSON.parse(fs.readFileSync(path.join(root, "scripts/us-english-allow.json"), "utf8")) : []).map((s) => s.toLowerCase()));

const hits = [];
for (const [where, text] of fields) {
  if (!text) continue;
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const w = m[0];
      if (ALLOW.has(w) || ALLOW.has(w.toLowerCase()) || ALLOW_HITS.has(w.toLowerCase()) || ALLOW_HITS.has((where + ":" + w).toLowerCase())) continue;
      hits.push(`${where}: "${w}" ... ${text.slice(Math.max(0, m.index - 40), m.index + w.length + 40).replace(/\s+/g, " ")}`);
    }
  }
}
if (hits.length) { console.log(hits.join("\n")); console.log(`\n${hits.length} unexplained hit(s)`); process.exit(1); }
console.log("US English check: 0 unexplained hits");
