// Curated playlists. Items are listed [releaseId, note|null]; generate-data.mjs sorts each list by release date
// (stable, so ties keep the order written here), so every playlist runs in release order.
export const playlists = [
{
  id: "roots-of-thrash",
  title: "Roots of Thrash",
  description: "The records that the Big Four and the Bay Area bands grew up on, from Sabbath's doom to Venom's noise and the punk speed of Discharge. In release order.",
  items: [
    ["black-sabbath-paranoid", "The template for heavy riffs and dark themes."],
    ["deep-purple-deep-purple-in-rock", "Fast, aggressive guitar and organ, and Ian Gillan's screams."],
    ["budgie-never-turn-your-back-on-a-friend", "Includes 'Breadfan', which Metallica later covered."],
    ["judas-priest-sad-wings-of-destiny", "The twin-guitar attack and operatic vocals that became a metal template."],
    ["ramones-ramones", "Fourteen songs in under thirty minutes: speed and brevity that thrash took up."],
    ["motorhead-overkill", "Its double-bass-drum title track is often cited as an ancestor of speed metal."],
    ["diamond-head-lightning-to-the-nations", "Metallica covered songs from it, including 'Am I Evil?'."],
    ["iron-maiden-iron-maiden", "NWOBHM energy with a punk edge."],
    ["venom-welcome-to-hell", "Raw and deliberately extreme, a blueprint for thrash, death and black metal."],
    ["misfits-earth-a-d-wolfs-blood", "Includes 'Green Hell', which Metallica covered on Garage Days Re-Revisited."],
    ["discharge-hear-nothing-see-nothing-say-nothing", "The d-beat that punks and thrash bands imitated."],
    ["mercyful-fate-melissa", "King Diamond's falsetto and intricate twin-guitar riffs."]
  ]
},
{
  id: "big-four-1983-1988",
  title: "The Big Four, 1983–1988",
  description: "Metallica, Slayer, Megadeth and Anthrax in their first great run, in release order.",
  items: [
    ["metallica-kill-em-all", "The debut that kicked off American thrash."],
    ["slayer-show-no-mercy", "Slayer's debut, on Metal Blade."],
    ["metallica-ride-the-lightning", "Acoustic passages and more complex songs."],
    ["megadeth-killing-is-my-business-and-business-is-good", "Recorded on a tiny budget, with intricate riffing."],
    ["anthrax-spreading-the-disease", "The first Anthrax album with singer Joey Belladonna."],
    ["metallica-master-of-puppets", "The last album with Cliff Burton."],
    ["megadeth-peace-sells-but-whos-buying", "Megadeth's second album, with the title track and 'Wake Up Dead'."],
    ["slayer-reign-in-blood", "A 29-minute classic produced by Rick Rubin."],
    ["anthrax-among-the-living", "Anthrax's breakthrough, with 'Caught in a Mosh' and 'I Am the Law'."],
    ["megadeth-so-far-so-good-so-what", "Includes 'In My Darkest Hour'."],
    ["slayer-south-of-heaven", "A slower, more atmospheric follow-up to Reign in Blood."],
    ["metallica-and-justice-for-all", "The first album with Jason Newsted, and a famously dry mix."]
  ]
},
{
  id: "bay-area-thrash",
  title: "Bay Area Thrash",
  description: "San Francisco Bay Area thrash, from Metallica's relocation through the second wave, in release order.",
  items: [
    ["metallica-ride-the-lightning", "Metallica had relocated to the Bay Area in early 1983."],
    ["exodus-bonded-by-blood", "A landmark of Bay Area thrash."],
    ["possessed-seven-churches", "Widely cited as a foundational death metal album."],
    ["testament-the-legacy", "Melodic thrash led by Chuck Billy's vocals."],
    ["death-angel-the-ultra-violence", "Made by teenagers, with a ten-minute title track."],
    ["heathen-breaking-the-silence", null],
    ["exodus-pleasures-of-the-flesh", "The first Exodus album with Steve Souza."],
    ["testament-the-new-order", "A tighter second album."],
    ["vio-lence-eternal-nightmare", "Second-wave thrash."],
    ["forbidden-forbidden-evil", "Technical Bay Area thrash."],
    ["testament-practice-what-you-preach", "A third album with a sharper, heavy sound."],
    ["vio-lence-oppressing-the-masses", "More technical playing."]
  ]
},
{
  id: "teutonic-thrash",
  title: "Teutonic Thrash",
  description: "The German thrash trio of Kreator, Sodom and Destruction, plus Tankard, in release order.",
  items: [
    ["destruction-sentence-of-death", "Destruction's first EP."],
    ["sodom-in-the-sign-of-evil", "Raw, Venom-inspired debut EP."],
    ["kreator-endless-pain", "Raw debut on the Noise label."],
    ["destruction-infernal-overkill", "A raw, fast debut."],
    ["sodom-obsessed-by-cruelty", "Sodom's first album."],
    ["kreator-pleasure-to-kill", "Extremely fast and brutal, it helped lay the ground for death metal."],
    ["tankard-zombie-attack", "Debut with party-themed lyrics."],
    ["kreator-terrible-certainty", "A tighter, more technical sound."],
    ["sodom-persecution-mania", "Fast and technical."],
    ["sodom-agent-orange", "Lyrics about the Vietnam War."],
    ["kreator-extreme-aggression", "A tighter, more focused sound."],
    ["kreator-coma-of-souls", "A more mature, melodic album."]
  ]
},
{
  id: "nwobhm-essentials",
  title: "NWOBHM Essentials",
  description: "The New Wave of British Heavy Metal, from the first tape to Maiden's breakthrough, in release order.",
  items: [
    ["saxon-saxon", "Saxon's debut."],
    ["iron-maiden-the-soundhouse-tapes", "Self-released EP, helped by Neal Kay's Soundhouse sound system."],
    ["saxon-wheels-of-steel", "An NWOBHM landmark."],
    ["iron-maiden-iron-maiden", "Maiden's debut with Paul Di'Anno."],
    ["girlschool-demolition", "Debut by the all-female band."],
    ["tygers-of-pan-tang-wild-cat", null],
    ["diamond-head-lightning-to-the-nations", "The self-released 'White Album'."],
    ["angel-witch-angel-witch", "The title track is an NWOBHM classic."],
    ["raven-rock-until-you-drop", "Debut of the high-speed trio."],
    ["tank-filth-hounds-of-hades", "Raw, Motörhead-influenced debut."],
    ["iron-maiden-the-number-of-the-beast", "The first Maiden album with Bruce Dickinson."],
    ["saxon-power-and-the-glory", "A classic of the movement's later years."]
  ]
},
{
  id: "crossover",
  title: "Crossover: Hardcore Meets Thrash",
  description: "Hardcore punk bands that picked up metal riffs and thrash bands that took up punk speed, in release order.",
  items: [
    ["black-flag-damaged", "A landmark of American hardcore."],
    ["bad-brains-bad-brains", "Cassette-only debut of ultra-fast hardcore."],
    ["discharge-hear-nothing-see-nothing-say-nothing", "Defined the d-beat."],
    ["suicidal-tendencies-suicidal-tendencies", "Venice hardcore with 'Institutionalized'."],
    ["dri-dealing-with-it", null],
    ["sod-speak-english-or-die", "Thrash, hardcore and crude humor from members of Anthrax."],
    ["corrosion-of-conformity-animosity", "A fast, heavy hardcore album."],
    ["cro-mags-the-age-of-quarrel", "Hardcore with metal riffs."],
    ["agnostic-front-cause-for-alarm", "A thrash-influenced New York album."],
    ["dri-crossover", "Marked D.R.I.'s turn toward metal."],
    ["suicidal-tendencies-how-will-i-laugh-tomorrow-when-i-cant-even-smile-today", "Thrash-flavored crossover."],
    ["slayer-undisputed-attitude", "Slayer's album of punk covers."]
  ]
},
{
  id: "birth-of-death-metal",
  title: "Birth of Death Metal",
  description: "From Possessed and Kreator to the Florida and Stockholm scenes, in release order.",
  items: [
    ["possessed-seven-churches", "Widely cited as a foundational death metal album."],
    ["kreator-pleasure-to-kill", "Thrash pushed to extremes."],
    ["death-scream-bloody-gore", "Widely called the first true death metal album."],
    ["death-leprosy", "Cemented the Florida death metal sound."],
    ["obituary-slowly-we-rot", "Slow, heavy, groove-based debut."],
    ["autopsy-severed-survival", "A slow, gory, influential debut."],
    ["morbid-angel-altars-of-madness", "A landmark of American death metal."],
    ["entombed-left-hand-path", "The defining Swedish death metal album."],
    ["deicide-deicide", "Florida debut with blasphemous themes."],
    ["obituary-cause-of-death", "A heavier, more technical album."],
    ["cannibal-corpse-eaten-back-to-life", "Brutal death metal debut."],
    ["death-human", "A step toward progressive and technical death metal."]
  ]
},
{
  id: "black-grind-origins",
  title: "Black / Grind Origins",
  description: "Venom's noise, Hellhammer's primitivism, Bathory's raw sound, and the grindcore that followed, in release order.",
  items: [
    ["venom-black-metal", "Gave an entire genre its name."],
    ["hellhammer-apocalyptic-raids", "Crude and deliberately cruel."],
    ["bathory-bathory", "Raw, Venom-inspired debut."],
    ["celtic-frost-to-mega-therion", "Avant-garde extreme metal with an H. R. Giger cover."],
    ["napalm-death-scum", "The founding grindcore record."],
    ["sarcofago-i-n-r-i", "A Brazilian extreme-metal landmark."],
    ["mayhem-deathcrush", "Early Norwegian extreme metal."],
    ["carcass-reek-of-putrefaction", "A gory grindcore debut."],
    ["bathory-blood-fire-death", "A turn toward epic Viking themes."],
    ["repulsion-horrified", "An early grindcore and death metal landmark."],
    ["terrorizer-world-downfall", "Fast, brutal grindcore."],
    ["bathory-hammerheart", null],
    ["mayhem-de-mysteriis-dom-sathanas", "Often named a foundational album of Norwegian black metal."]
  ]
},
{
  id: "thrash-goes-big-1990-1994",
  title: "Thrash Goes Big, 1990–1994",
  description: "Thrash and groove metal at their commercial peak, from Rust in Peace to Far Beyond Driven, in release order.",
  items: [
    ["anthrax-persistence-of-time", "A darker Anthrax album."],
    ["pantera-cowboys-from-hell", "Major-label debut and a groove-driven new sound."],
    ["megadeth-rust-in-peace", "Marty Friedman's arrival made it Megadeth's technical peak."],
    ["slayer-seasons-in-the-abyss", "Heavy, mid-tempo late-era Slayer."],
    ["sepultura-arise", "Sepultura's fourth album, a blend of thrash and death."],
    ["metallica-metallica", "The 'Black Album' brought Metallica to a mass audience."],
    ["pantera-vulgar-display-of-power", "The groove-metal landmark."],
    ["megadeth-countdown-to-extinction", "A big commercial success with a more melodic style."],
    ["testament-the-ritual", null],
    ["anthrax-sound-of-white-noise", "The first album with John Bush."],
    ["sepultura-chaos-a-d", "Groove-driven, political thrash."],
    ["pantera-far-beyond-driven", "Debuted at number one on the Billboard 200."]
  ]
},
{
  id: "speed-kills-starter",
  title: "Speed Kills Starter",
  description: "The twelve albums to hear first, from Sabbath to Rust in Peace, in release order.",
  items: [
    ["black-sabbath-paranoid", "Sabbath's breakthrough, with 'War Pigs' and 'Iron Man'."],
    ["motorhead-ace-of-spades", "A speed-metal anthem and Motörhead's best-known album."],
    ["iron-maiden-the-number-of-the-beast", "Twin guitars and Dickinson's voice."],
    ["metallica-kill-em-all", "The start of American thrash."],
    ["metallica-ride-the-lightning", null],
    ["exodus-bonded-by-blood", "A landmark of Bay Area thrash."],
    ["metallica-master-of-puppets", "The last album with Cliff Burton."],
    ["megadeth-peace-sells-but-whos-buying", null],
    ["slayer-reign-in-blood", "Speed and brutality in under thirty minutes."],
    ["anthrax-among-the-living", "East Coast thrash with humor and hooks."],
    ["death-scream-bloody-gore", "Widely called the first true death metal album."],
    ["megadeth-rust-in-peace", "Thrash at its most technical."]
  ]
}
];
