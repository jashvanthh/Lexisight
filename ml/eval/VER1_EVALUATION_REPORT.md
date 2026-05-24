# LexiSight Ver1 Evaluation Report

**Generated:** 2026-05-23T09:28:58Z
**Model:** TemporalLandmarkTransformer_v1 (`training_logs\temporal_best.keras`)
**Architecture:** Temporal Landmark Transformer v1 — input `(30, 126)`, **263** classes
**Deployed as:** Word Mode `[Ver1]` → `public/model/tfjs_model/`
**Label map:** `public/model/label_map.json`

> **Ver1** = temporal **word** model (263 ISL signs). **v1** in the ideology doc = static fingerspelling (A–Z, 0–9) — different model.

## Data sources

### Used for training & evaluation

| Property | Value |
|----------|-------|
| Dataset | **INCLUDE_FULL** (`include`) |
| Description | Indian Sign Language videos from IIT Madras / AI4Bharat INCLUDE corpus (Sridhar et al., 2020). Landmark sequences extracted with MediaPipe Hands, 30 frames per clip, stored as .npy tensors. |
| Raw videos | `Datasets/INCLUDE_FULL DATASET` |
| Processed landmarks | `ml/data_processed/include/` |
| Clips in manifest | 4,259 |
| Clips evaluated (this run) | 4,259 |
| Word classes | **263** |
| Signer IDs | MVI |
| Clips per class (min / mean / max) | 4 / 16.2 / 27 |

### Not used in Ver1 (present elsewhere in repo / ideology)

| Dataset | Clips in manifest | Why excluded |
|---------|-------------------|--------------|
| ISL static image sets (A–Z, 0–9) | 71,352 | Used for the separate static/fingerspelling model, not Ver1 temporal words. |
| CISLR v1.5-a | 0 | Not present in current manifest; not trained into this Ver1 checkpoint. |
| ISL_Daily_Words | 0 | Not merged into this build (ideology: prioritize when multi-signer depth exists). |
| ISL_Emergency | 0 | Not merged into this build. |

### Full manifest inventory (all sources)

| Source | Clip count |
|--------|------------|
| `static_images` | 71,352 |
| `include` | 4,259 |

## Train / validation split

| Field | Value |
|-------|-------|
| Split method | stratified_random (single signer — NOT signer-disjoint) |
| Random seed | 42 |
| Validation ratio | 20% |
| Train clips | 3,407 |
| Validation clips | 852 |
| Preprocessing | reshape(30,126) from .npy — no normalize_skeleton (matches train_video_only/v2) |

## Vocabulary — 263 ISL words

All words below are in `label_map.json` and the model softmax. Categories come from INCLUDE_FULL folder structure (`Datasets/INCLUDE_FULL DATASET/<Category>/<Word>/`).

### Words per INCLUDE category

| Category | # words |
|----------|---------|
| Adjectives | 59 |
| Home | 27 |
| People | 26 |
| Society | 23 |
| Days and Time | 21 |
| Places | 19 |
| Jobs | 16 |
| Colours | 11 |
| Clothes | 10 |
| Electronics | 10 |
| Greetings | 9 |
| Means of Transportation | 9 |
| Animals | 8 |
| Pronouns | 8 |
| Seasons | 6 |
| Unknown | 1 |

### Full word list by category

#### Adjectives (59 words)

- **ALIVE** (8 clips, val 100%) · **BAD** (21 clips, val 100%) · **BEAUTIFUL** (8 clips, val 100%) · **BIG LARGE** (21 clips, val 100%) · **BLIND** (8 clips, val 100%) · **CHEAP** (8 clips, val 100%)
- **CLEAN** (8 clips, val 50%) · **COLD** (20 clips, val 75%) · **COOL** (21 clips, val 100%) · **CURVED** (8 clips, val 100%) · **DEAD** (8 clips, val 100%) · **DEAF** (8 clips, val 100%)
- **DEEP** (8 clips, val 100%) · **DIRTY** (8 clips, val 100%) · **DRY** (21 clips, val 100%) · **EXPENSIVE** (8 clips, val 100%) · **FAMOUS** (8 clips, val 100%) · **FAST** (21 clips, val 75%)
- **FEMALE** (8 clips, val 0%) · **FLAT** (8 clips, val 50%) · **GOOD** (21 clips, val 100%) · **HAPPY** (21 clips, val 75%) · **HARD** (8 clips, val 50%) · **HEALTHY** (21 clips, val 100%)
- **HEAVY** (8 clips, val 100%) · **HIGH** (8 clips, val 100%) · **HOT** (21 clips, val 100%) · **LIGHT** (8 clips, val 100%) · **LONG** (21 clips, val 100%) · **LOOSE** (8 clips, val 100%)
- **LOUD** (21 clips, val 100%) · **LOW** (8 clips, val 100%) · **MALE** (8 clips, val 100%) · **MEAN** (8 clips, val 100%) · **NARROW** (21 clips, val 100%) · **NEW** (21 clips, val 50%)
- **NICE** (4 clips, val 0%) · **OLD** (21 clips, val 75%) · **POOR** (8 clips, val 100%) · **QUIET** (21 clips, val 75%) · **RICH** (8 clips, val 0%) · **SAD** (8 clips, val 100%)
- **SHALLOW** (8 clips, val 100%) · **SHORT** (21 clips, val 100%) · **SICK** (21 clips, val 100%) · **SLOW** (21 clips, val 100%) · **SMALL LITTLE** (21 clips, val 25%) · **SOFT** (8 clips, val 100%)
- **STRONG** (8 clips, val 100%) · **TALL** (21 clips, val 100%) · **THICK** (8 clips, val 50%) · **THIN** (4 clips, val 0%) · **TIGHT** (8 clips, val 100%) · **UGLY** (8 clips, val 100%)
- **WARM** (21 clips, val 100%) · **WEAK** (8 clips, val 100%) · **WET** (21 clips, val 75%) · **WIDE** (21 clips, val 75%) · **YOUNG** (21 clips, val 50%)

#### Animals (8 words)

- **ANIMAL** (20 clips, val 100%) · **BIRD** (20 clips, val 100%) · **CAT** (20 clips, val 100%) · **COW** (21 clips, val 100%) · **DOG** (20 clips, val 50%) · **FISH** (20 clips, val 75%)
- **HORSE** (18 clips, val 50%) · **MOUSE** (20 clips, val 50%)

#### Clothes (10 words)

- **CLOTHING** (20 clips, val 75%) · **DRESS** (20 clips, val 25%) · **HAT** (20 clips, val 75%) · **PANT** (20 clips, val 100%) · **POCKET** (19 clips, val 75%) · **SHIRT** (20 clips, val 100%)
- **SHOES** (20 clips, val 100%) · **SKIRT** (19 clips, val 75%) · **SUIT** (19 clips, val 100%) · **T-SHIRT** (20 clips, val 100%)

#### Colours (11 words)

- **BLACK** (20 clips, val 75%) · **BLUE** (20 clips, val 50%) · **BROWN** (21 clips, val 100%) · **COLOUR** (20 clips, val 100%) · **GREEN** (20 clips, val 100%) · **GREY** (21 clips, val 75%)
- **ORANGE** (20 clips, val 100%) · **PINK** (20 clips, val 100%) · **RED** (20 clips, val 0%) · **WHITE** (20 clips, val 75%) · **YELLOW** (20 clips, val 100%)

#### Days and Time (21 words)

- **AFTERNOON** (14 clips, val 100%) · **EVENING** (14 clips, val 100%) · **FRIDAY** (12 clips, val 50%) · **HOUR** (12 clips, val 100%) · **MINUTE** (14 clips, val 100%) · **MONDAY** (14 clips, val 100%)
- **MONTH** (14 clips, val 100%) · **MORNING** (14 clips, val 67%) · **NIGHT** (15 clips, val 67%) · **SATURDAY** (14 clips, val 33%) · **SECOND** (12 clips, val 50%) · **SUNDAY** (13 clips, val 67%)
- **THURSDAY** (12 clips, val 50%) · **TIME** (14 clips, val 67%) · **TODAY** (12 clips, val 50%) · **TOMORROW** (13 clips, val 33%) · **TUESDAY** (11 clips, val 50%) · **WEDNESDAY** (14 clips, val 100%)
- **WEEK** (14 clips, val 33%) · **YEAR** (15 clips, val 100%) · **YESTERDAY** (14 clips, val 67%)

#### Electronics (10 words)

- **CAMERA** (14 clips, val 100%) · **CELL PHONE** (13 clips, val 67%) · **CLOCK** (13 clips, val 67%) · **COMPUTER** (14 clips, val 100%) · **FAN** (15 clips, val 100%) · **LAMP** (14 clips, val 67%)
- **LAPTOP** (13 clips, val 67%) · **RADIO** (14 clips, val 100%) · **SCREEN** (14 clips, val 100%) · **TELEVISION** (14 clips, val 100%)

#### Greetings (9 words)

- **ALRIGHT** (21 clips, val 100%) · **GOOD AFTERNOON** (22 clips, val 75%) · **GOOD EVENING** (21 clips, val 75%) · **GOOD MORNING** (21 clips, val 75%) · **GOOD NIGHT** (21 clips, val 75%) · **HELLO** (21 clips, val 50%)
- **HOW ARE YOU** (21 clips, val 100%) · **PLEASED** (21 clips, val 100%) · **THANK_YOU** (21 clips, val 100%)

#### Home (27 words)

- **BAG** (14 clips, val 67%) · **BATHROOM** (14 clips, val 67%) · **BED** (14 clips, val 100%) · **BEDROOM** (14 clips, val 100%) · **BOOK** (14 clips, val 100%) · **BOX** (14 clips, val 67%)
- **CARD** (14 clips, val 100%) · **CHAIR** (14 clips, val 67%) · **DOOR** (14 clips, val 100%) · **DREAM** (14 clips, val 100%) · **GIFT** (14 clips, val 67%) · **KEY** (14 clips, val 67%)
- **KITCHEN** (14 clips, val 100%) · **LETTER** (14 clips, val 100%) · **LOCK** (14 clips, val 67%) · **PAGE** (14 clips, val 67%) · **PAINT** (15 clips, val 100%) · **PAPER** (14 clips, val 100%)
- **PEN** (14 clips, val 100%) · **PENCIL** (14 clips, val 67%) · **PHOTOGRAPH** (14 clips, val 33%) · **RING** (14 clips, val 67%) · **SOAP** (14 clips, val 33%) · **TABLE** (14 clips, val 100%)
- **TELEPHONE** (14 clips, val 100%) · **TOOL** (14 clips, val 67%) · **WINDOW** (14 clips, val 100%)

#### Jobs (16 words)

- **ACTOR** (14 clips, val 67%) · **ARTIST** (14 clips, val 67%) · **AUTHOR** (14 clips, val 100%) · **DOCTOR** (14 clips, val 67%) · **JOB** (14 clips, val 100%) · **LAWYER** (14 clips, val 33%)
- **MANAGER** (14 clips, val 67%) · **PATIENT** (14 clips, val 100%) · **POLICE** (14 clips, val 100%) · **PRIEST** (15 clips, val 100%) · **REPORTER** (14 clips, val 100%) · **SECRETARY** (14 clips, val 100%)
- **SOLDIER** (14 clips, val 100%) · **STUDENT** (14 clips, val 67%) · **TEACHER** (14 clips, val 100%) · **WAITER** (14 clips, val 67%)

#### Means of Transportation (9 words)

- **BICYCLE** (20 clips, val 75%) · **BOAT** (21 clips, val 75%) · **BUS** (20 clips, val 75%) · **CAR** (20 clips, val 100%) · **PLANE** (21 clips, val 100%) · **TRAIN** (21 clips, val 100%)
- **TRAIN TICKET** (21 clips, val 75%) · **TRANSPORTATION** (21 clips, val 100%) · **TRUCK** (21 clips, val 100%)

#### People (26 words)

- **ADULT** (20 clips, val 75%) · **BABY** (20 clips, val 50%) · **BOY** (21 clips, val 25%) · **BROTHER** (21 clips, val 100%) · **CHILD** (20 clips, val 100%) · **CROWD** (20 clips, val 100%)
- **DAUGHTER** (20 clips, val 100%) · **FAMILY** (17 clips, val 67%) · **FATHER** (20 clips, val 100%) · **FRIEND** (20 clips, val 75%) · **GIRL** (20 clips, val 100%) · **GRANDFATHER** (17 clips, val 100%)
- **GRANDMOTHER** (17 clips, val 100%) · **HUSBAND** (20 clips, val 75%) · **KING** (20 clips, val 100%) · **MAN** (20 clips, val 75%) · **MOTHER** (20 clips, val 25%) · **NEIGHBOUR** (20 clips, val 100%)
- **PARENT** (20 clips, val 50%) · **PLAYER** (20 clips, val 100%) · **PRESIDENT** (20 clips, val 100%) · **QUEEN** (20 clips, val 100%) · **SISTER** (20 clips, val 75%) · **SON** (20 clips, val 50%)
- **WIFE** (20 clips, val 75%) · **WOMAN** (20 clips, val 50%)

#### Places (19 words)

- **BANK** (20 clips, val 100%) · **CITY** (20 clips, val 100%) · **COURT** (20 clips, val 25%) · **GROUND** (20 clips, val 100%) · **HOSPITAL** (20 clips, val 100%) · **HOUSE** (20 clips, val 75%)
- **INDIA** (20 clips, val 75%) · **LIBRARY** (20 clips, val 100%) · **LOCATION** (20 clips, val 100%) · **MARKET** (20 clips, val 100%) · **OFFICE** (20 clips, val 100%) · **PARK** (20 clips, val 100%)
- **RESTAURANT** (20 clips, val 50%) · **SCHOOL** (20 clips, val 75%) · **STORE OR SHOP** (20 clips, val 50%) · **STREET OR ROAD** (20 clips, val 75%) · **TEMPLE** (20 clips, val 100%) · **TRAIN STATION** (20 clips, val 75%)
- **UNIVERSITY** (20 clips, val 100%)

#### Pronouns (8 words)

- **HE** (21 clips, val 100%) · **I** (21 clips, val 75%) · **IT** (21 clips, val 75%) · **SHE** (21 clips, val 75%) · **THEY** (21 clips, val 100%) · **WE** (21 clips, val 50%)
- **YOU** (21 clips, val 100%) · **YOU (PLURAL)** (21 clips, val 100%)

#### Seasons (6 words)

- **EX. MONSOON** (14 clips, val 67%) · **FALL** (12 clips, val 0%) · **SEASON** (14 clips, val 67%) · **SPRING** (14 clips, val 67%) · **SUMMER** (14 clips, val 100%) · **WINTER** (14 clips, val 100%)

#### Society (23 words)

- **ATTACK** (15 clips, val 100%) · **BALL** (15 clips, val 67%) · **BILL** (14 clips, val 33%) · **DEATH** (14 clips, val 100%) · **ELECTION** (14 clips, val 100%) · **ENERGY** (14 clips, val 100%)
- **EXERCISE** (14 clips, val 67%) · **GOD** (14 clips, val 33%) · **GUN** (14 clips, val 33%) · **MARRIAGE** (14 clips, val 100%) · **MEDICINE** (14 clips, val 100%) · **MONEY** (14 clips, val 67%)
- **NEWSPAPER** (14 clips, val 100%) · **PEACE** (14 clips, val 100%) · **PRICE** (14 clips, val 100%) · **RACE (ETHNICITY)** (14 clips, val 33%) · **RELIGION** (14 clips, val 100%) · **SCIENCE** (14 clips, val 100%)
- **SIGN** (14 clips, val 67%) · **SPORT** (14 clips, val 100%) · **TEAM** (14 clips, val 100%) · **TECHNOLOGY** (14 clips, val 67%) · **WAR** (14 clips, val 100%)

#### Unknown (1 words)

- **EXTRA** (27 clips, val 0%)

### Vocabulary table (with validation metrics)

Detailed per-class CSV: `ml/eval/ver1_per_class.csv`

| # | Word | Category | Total | Train | Val | Val acc |
|---|------|----------|-------|-------|-----|---------|
| 0 | ACTOR | Jobs | 14 | 11 | 3 | 66.7% |
| 1 | ADULT | People | 20 | 16 | 4 | 75.0% |
| 2 | AFTERNOON | Days and Time | 14 | 11 | 3 | 100.0% |
| 3 | ALIVE | Adjectives | 8 | 6 | 2 | 100.0% |
| 4 | ALRIGHT | Greetings | 21 | 17 | 4 | 100.0% |
| 5 | ANIMAL | Animals | 20 | 16 | 4 | 100.0% |
| 6 | ARTIST | Jobs | 14 | 11 | 3 | 66.7% |
| 7 | ATTACK | Society | 15 | 12 | 3 | 100.0% |
| 8 | AUTHOR | Jobs | 14 | 11 | 3 | 100.0% |
| 9 | BABY | People | 20 | 16 | 4 | 50.0% |
| 10 | BAD | Adjectives | 21 | 17 | 4 | 100.0% |
| 11 | BAG | Home | 14 | 11 | 3 | 66.7% |
| 12 | BALL | Society | 15 | 12 | 3 | 66.7% |
| 13 | BANK | Places | 20 | 16 | 4 | 100.0% |
| 14 | BATHROOM | Home | 14 | 11 | 3 | 66.7% |
| 15 | BEAUTIFUL | Adjectives | 8 | 7 | 1 | 100.0% |
| 16 | BED | Home | 14 | 11 | 3 | 100.0% |
| 17 | BEDROOM | Home | 14 | 11 | 3 | 100.0% |
| 18 | BICYCLE | Means of Transportation | 20 | 16 | 4 | 75.0% |
| 19 | BIG LARGE | Adjectives | 21 | 17 | 4 | 100.0% |
| 20 | BILL | Society | 14 | 11 | 3 | 33.3% |
| 21 | BIRD | Animals | 20 | 16 | 4 | 100.0% |
| 22 | BLACK | Colours | 20 | 16 | 4 | 75.0% |
| 23 | BLIND | Adjectives | 8 | 6 | 2 | 100.0% |
| 24 | BLUE | Colours | 20 | 16 | 4 | 50.0% |
| 25 | BOAT | Means of Transportation | 21 | 17 | 4 | 75.0% |
| 26 | BOOK | Home | 14 | 11 | 3 | 100.0% |
| 27 | BOX | Home | 14 | 11 | 3 | 66.7% |
| 28 | BOY | People | 21 | 17 | 4 | 25.0% |
| 29 | BROTHER | People | 21 | 17 | 4 | 100.0% |
| 30 | BROWN | Colours | 21 | 17 | 4 | 100.0% |
| 31 | BUS | Means of Transportation | 20 | 16 | 4 | 75.0% |
| 32 | CAMERA | Electronics | 14 | 11 | 3 | 100.0% |
| 33 | CAR | Means of Transportation | 20 | 16 | 4 | 100.0% |
| 34 | CARD | Home | 14 | 11 | 3 | 100.0% |
| 35 | CAT | Animals | 20 | 16 | 4 | 100.0% |
| 36 | CELL PHONE | Electronics | 13 | 10 | 3 | 66.7% |
| 37 | CHAIR | Home | 14 | 11 | 3 | 66.7% |
| 38 | CHEAP | Adjectives | 8 | 7 | 1 | 100.0% |
| 39 | CHILD | People | 20 | 16 | 4 | 100.0% |
| 40 | CITY | Places | 20 | 16 | 4 | 100.0% |
| 41 | CLEAN | Adjectives | 8 | 6 | 2 | 50.0% |
| 42 | CLOCK | Electronics | 13 | 10 | 3 | 66.7% |
| 43 | CLOTHING | Clothes | 20 | 16 | 4 | 75.0% |
| 44 | COLD | Adjectives | 20 | 16 | 4 | 75.0% |
| 45 | COLOUR | Colours | 20 | 16 | 4 | 100.0% |
| 46 | COMPUTER | Electronics | 14 | 11 | 3 | 100.0% |
| 47 | COOL | Adjectives | 21 | 17 | 4 | 100.0% |
| 48 | COURT | Places | 20 | 16 | 4 | 25.0% |
| 49 | COW | Animals | 21 | 17 | 4 | 100.0% |
| 50 | CROWD | People | 20 | 16 | 4 | 100.0% |
| 51 | CURVED | Adjectives | 8 | 7 | 1 | 100.0% |
| 52 | DAUGHTER | People | 20 | 16 | 4 | 100.0% |
| 53 | DEAD | Adjectives | 8 | 6 | 2 | 100.0% |
| 54 | DEAF | Adjectives | 8 | 7 | 1 | 100.0% |
| 55 | DEATH | Society | 14 | 11 | 3 | 100.0% |
| 56 | DEEP | Adjectives | 8 | 6 | 2 | 100.0% |
| 57 | DIRTY | Adjectives | 8 | 6 | 2 | 100.0% |
| 58 | DOCTOR | Jobs | 14 | 11 | 3 | 66.7% |
| 59 | DOG | Animals | 20 | 16 | 4 | 50.0% |
| 60 | DOOR | Home | 14 | 11 | 3 | 100.0% |
| 61 | DREAM | Home | 14 | 11 | 3 | 100.0% |
| 62 | DRESS | Clothes | 20 | 16 | 4 | 25.0% |
| 63 | DRY | Adjectives | 21 | 17 | 4 | 100.0% |
| 64 | ELECTION | Society | 14 | 11 | 3 | 100.0% |
| 65 | ENERGY | Society | 14 | 11 | 3 | 100.0% |
| 66 | EVENING | Days and Time | 14 | 11 | 3 | 100.0% |
| 67 | EX. MONSOON | Seasons | 14 | 11 | 3 | 66.7% |
| 68 | EXERCISE | Society | 14 | 11 | 3 | 66.7% |
| 69 | EXPENSIVE | Adjectives | 8 | 7 | 1 | 100.0% |
| 70 | EXTRA | Unknown | 27 | 22 | 5 | 0.0% |
| 71 | FALL | Seasons | 12 | 10 | 2 | 0.0% |
| 72 | FAMILY | People | 17 | 14 | 3 | 66.7% |
| 73 | FAMOUS | Adjectives | 8 | 7 | 1 | 100.0% |
| 74 | FAN | Electronics | 15 | 12 | 3 | 100.0% |
| 75 | FAST | Adjectives | 21 | 17 | 4 | 75.0% |
| 76 | FATHER | People | 20 | 16 | 4 | 100.0% |
| 77 | FEMALE | Adjectives | 8 | 7 | 1 | 0.0% |
| 78 | FISH | Animals | 20 | 16 | 4 | 75.0% |
| 79 | FLAT | Adjectives | 8 | 6 | 2 | 50.0% |
| 80 | FRIDAY | Days and Time | 12 | 10 | 2 | 50.0% |
| 81 | FRIEND | People | 20 | 16 | 4 | 75.0% |
| 82 | GIFT | Home | 14 | 11 | 3 | 66.7% |
| 83 | GIRL | People | 20 | 16 | 4 | 100.0% |
| 84 | GOD | Society | 14 | 11 | 3 | 33.3% |
| 85 | GOOD | Adjectives | 21 | 17 | 4 | 100.0% |
| 86 | GOOD AFTERNOON | Greetings | 22 | 18 | 4 | 75.0% |
| 87 | GOOD EVENING | Greetings | 21 | 17 | 4 | 75.0% |
| 88 | GOOD MORNING | Greetings | 21 | 17 | 4 | 75.0% |
| 89 | GOOD NIGHT | Greetings | 21 | 17 | 4 | 75.0% |
| 90 | GRANDFATHER | People | 17 | 14 | 3 | 100.0% |
| 91 | GRANDMOTHER | People | 17 | 14 | 3 | 100.0% |
| 92 | GREEN | Colours | 20 | 16 | 4 | 100.0% |
| 93 | GREY | Colours | 21 | 17 | 4 | 75.0% |
| 94 | GROUND | Places | 20 | 16 | 4 | 100.0% |
| 95 | GUN | Society | 14 | 11 | 3 | 33.3% |
| 96 | HAPPY | Adjectives | 21 | 17 | 4 | 75.0% |
| 97 | HARD | Adjectives | 8 | 6 | 2 | 50.0% |
| 98 | HAT | Clothes | 20 | 16 | 4 | 75.0% |
| 99 | HE | Pronouns | 21 | 17 | 4 | 100.0% |
| 100 | HEALTHY | Adjectives | 21 | 17 | 4 | 100.0% |
| 101 | HEAVY | Adjectives | 8 | 7 | 1 | 100.0% |
| 102 | HELLO | Greetings | 21 | 17 | 4 | 50.0% |
| 103 | HIGH | Adjectives | 8 | 7 | 1 | 100.0% |
| 104 | HORSE | Animals | 18 | 14 | 4 | 50.0% |
| 105 | HOSPITAL | Places | 20 | 16 | 4 | 100.0% |
| 106 | HOT | Adjectives | 21 | 17 | 4 | 100.0% |
| 107 | HOUR | Days and Time | 12 | 10 | 2 | 100.0% |
| 108 | HOUSE | Places | 20 | 16 | 4 | 75.0% |
| 109 | HOW ARE YOU | Greetings | 21 | 17 | 4 | 100.0% |
| 110 | HUSBAND | People | 20 | 16 | 4 | 75.0% |
| 111 | I | Pronouns | 21 | 17 | 4 | 75.0% |
| 112 | INDIA | Places | 20 | 16 | 4 | 75.0% |
| 113 | IT | Pronouns | 21 | 17 | 4 | 75.0% |
| 114 | JOB | Jobs | 14 | 11 | 3 | 100.0% |
| 115 | KEY | Home | 14 | 11 | 3 | 66.7% |
| 116 | KING | People | 20 | 16 | 4 | 100.0% |
| 117 | KITCHEN | Home | 14 | 11 | 3 | 100.0% |
| 118 | LAMP | Electronics | 14 | 11 | 3 | 66.7% |
| 119 | LAPTOP | Electronics | 13 | 10 | 3 | 66.7% |
| 120 | LAWYER | Jobs | 14 | 11 | 3 | 33.3% |
| 121 | LETTER | Home | 14 | 11 | 3 | 100.0% |
| 122 | LIBRARY | Places | 20 | 16 | 4 | 100.0% |
| 123 | LIGHT | Adjectives | 8 | 7 | 1 | 100.0% |
| 124 | LOCATION | Places | 20 | 16 | 4 | 100.0% |
| 125 | LOCK | Home | 14 | 11 | 3 | 66.7% |
| 126 | LONG | Adjectives | 21 | 17 | 4 | 100.0% |
| 127 | LOOSE | Adjectives | 8 | 7 | 1 | 100.0% |
| 128 | LOUD | Adjectives | 21 | 17 | 4 | 100.0% |
| 129 | LOW | Adjectives | 8 | 7 | 1 | 100.0% |
| 130 | MALE | Adjectives | 8 | 6 | 2 | 100.0% |
| 131 | MAN | People | 20 | 16 | 4 | 75.0% |
| 132 | MANAGER | Jobs | 14 | 11 | 3 | 66.7% |
| 133 | MARKET | Places | 20 | 16 | 4 | 100.0% |
| 134 | MARRIAGE | Society | 14 | 11 | 3 | 100.0% |
| 135 | MEAN | Adjectives | 8 | 7 | 1 | 100.0% |
| 136 | MEDICINE | Society | 14 | 11 | 3 | 100.0% |
| 137 | MINUTE | Days and Time | 14 | 11 | 3 | 100.0% |
| 138 | MONDAY | Days and Time | 14 | 11 | 3 | 100.0% |
| 139 | MONEY | Society | 14 | 11 | 3 | 66.7% |
| 140 | MONTH | Days and Time | 14 | 11 | 3 | 100.0% |
| 141 | MORNING | Days and Time | 14 | 11 | 3 | 66.7% |
| 142 | MOTHER | People | 20 | 16 | 4 | 25.0% |
| 143 | MOUSE | Animals | 20 | 16 | 4 | 50.0% |
| 144 | NARROW | Adjectives | 21 | 17 | 4 | 100.0% |
| 145 | NEIGHBOUR | People | 20 | 16 | 4 | 100.0% |
| 146 | NEW | Adjectives | 21 | 17 | 4 | 50.0% |
| 147 | NEWSPAPER | Society | 14 | 11 | 3 | 100.0% |
| 148 | NICE | Adjectives | 4 | 3 | 1 | 0.0% |
| 149 | NIGHT | Days and Time | 15 | 12 | 3 | 66.7% |
| 150 | OFFICE | Places | 20 | 16 | 4 | 100.0% |
| 151 | OLD | Adjectives | 21 | 17 | 4 | 75.0% |
| 152 | ORANGE | Colours | 20 | 16 | 4 | 100.0% |
| 153 | PAGE | Home | 14 | 11 | 3 | 66.7% |
| 154 | PAINT | Home | 15 | 12 | 3 | 100.0% |
| 155 | PANT | Clothes | 20 | 16 | 4 | 100.0% |
| 156 | PAPER | Home | 14 | 11 | 3 | 100.0% |
| 157 | PARENT | People | 20 | 16 | 4 | 50.0% |
| 158 | PARK | Places | 20 | 16 | 4 | 100.0% |
| 159 | PATIENT | Jobs | 14 | 11 | 3 | 100.0% |
| 160 | PEACE | Society | 14 | 11 | 3 | 100.0% |
| 161 | PEN | Home | 14 | 11 | 3 | 100.0% |
| 162 | PENCIL | Home | 14 | 11 | 3 | 66.7% |
| 163 | PHOTOGRAPH | Home | 14 | 11 | 3 | 33.3% |
| 164 | PINK | Colours | 20 | 16 | 4 | 100.0% |
| 165 | PLANE | Means of Transportation | 21 | 17 | 4 | 100.0% |
| 166 | PLAYER | People | 20 | 16 | 4 | 100.0% |
| 167 | PLEASED | Greetings | 21 | 17 | 4 | 100.0% |
| 168 | POCKET | Clothes | 19 | 15 | 4 | 75.0% |
| 169 | POLICE | Jobs | 14 | 11 | 3 | 100.0% |
| 170 | POOR | Adjectives | 8 | 6 | 2 | 100.0% |
| 171 | PRESIDENT | People | 20 | 16 | 4 | 100.0% |
| 172 | PRICE | Society | 14 | 11 | 3 | 100.0% |
| 173 | PRIEST | Jobs | 15 | 12 | 3 | 100.0% |
| 174 | QUEEN | People | 20 | 16 | 4 | 100.0% |
| 175 | QUIET | Adjectives | 21 | 17 | 4 | 75.0% |
| 176 | RACE (ETHNICITY) | Society | 14 | 11 | 3 | 33.3% |
| 177 | RADIO | Electronics | 14 | 11 | 3 | 100.0% |
| 178 | RED | Colours | 20 | 16 | 4 | 0.0% |
| 179 | RELIGION | Society | 14 | 11 | 3 | 100.0% |
| 180 | REPORTER | Jobs | 14 | 11 | 3 | 100.0% |
| 181 | RESTAURANT | Places | 20 | 16 | 4 | 50.0% |
| 182 | RICH | Adjectives | 8 | 7 | 1 | 0.0% |
| 183 | RING | Home | 14 | 11 | 3 | 66.7% |
| 184 | SAD | Adjectives | 8 | 7 | 1 | 100.0% |
| 185 | SATURDAY | Days and Time | 14 | 11 | 3 | 33.3% |
| 186 | SCHOOL | Places | 20 | 16 | 4 | 75.0% |
| 187 | SCIENCE | Society | 14 | 11 | 3 | 100.0% |
| 188 | SCREEN | Electronics | 14 | 11 | 3 | 100.0% |
| 189 | SEASON | Seasons | 14 | 11 | 3 | 66.7% |
| 190 | SECOND | Days and Time | 12 | 10 | 2 | 50.0% |
| 191 | SECRETARY | Jobs | 14 | 11 | 3 | 100.0% |
| 192 | SHALLOW | Adjectives | 8 | 7 | 1 | 100.0% |
| 193 | SHE | Pronouns | 21 | 17 | 4 | 75.0% |
| 194 | SHIRT | Clothes | 20 | 16 | 4 | 100.0% |
| 195 | SHOES | Clothes | 20 | 16 | 4 | 100.0% |
| 196 | SHORT | Adjectives | 21 | 17 | 4 | 100.0% |
| 197 | SICK | Adjectives | 21 | 17 | 4 | 100.0% |
| 198 | SIGN | Society | 14 | 11 | 3 | 66.7% |
| 199 | SISTER | People | 20 | 16 | 4 | 75.0% |
| 200 | SKIRT | Clothes | 19 | 15 | 4 | 75.0% |
| 201 | SLOW | Adjectives | 21 | 17 | 4 | 100.0% |
| 202 | SMALL LITTLE | Adjectives | 21 | 17 | 4 | 25.0% |
| 203 | SOAP | Home | 14 | 11 | 3 | 33.3% |
| 204 | SOFT | Adjectives | 8 | 7 | 1 | 100.0% |
| 205 | SOLDIER | Jobs | 14 | 11 | 3 | 100.0% |
| 206 | SON | People | 20 | 16 | 4 | 50.0% |
| 207 | SPORT | Society | 14 | 11 | 3 | 100.0% |
| 208 | SPRING | Seasons | 14 | 11 | 3 | 66.7% |
| 209 | STORE OR SHOP | Places | 20 | 16 | 4 | 50.0% |
| 210 | STREET OR ROAD | Places | 20 | 16 | 4 | 75.0% |
| 211 | STRONG | Adjectives | 8 | 7 | 1 | 100.0% |
| 212 | STUDENT | Jobs | 14 | 11 | 3 | 66.7% |
| 213 | SUIT | Clothes | 19 | 15 | 4 | 100.0% |
| 214 | SUMMER | Seasons | 14 | 11 | 3 | 100.0% |
| 215 | SUNDAY | Days and Time | 13 | 10 | 3 | 66.7% |
| 216 | T-SHIRT | Clothes | 20 | 16 | 4 | 100.0% |
| 217 | TABLE | Home | 14 | 11 | 3 | 100.0% |
| 218 | TALL | Adjectives | 21 | 17 | 4 | 100.0% |
| 219 | TEACHER | Jobs | 14 | 11 | 3 | 100.0% |
| 220 | TEAM | Society | 14 | 11 | 3 | 100.0% |
| 221 | TECHNOLOGY | Society | 14 | 11 | 3 | 66.7% |
| 222 | TELEPHONE | Home | 14 | 11 | 3 | 100.0% |
| 223 | TELEVISION | Electronics | 14 | 11 | 3 | 100.0% |
| 224 | TEMPLE | Places | 20 | 16 | 4 | 100.0% |
| 225 | THANK_YOU | Greetings | 21 | 17 | 4 | 100.0% |
| 226 | THEY | Pronouns | 21 | 17 | 4 | 100.0% |
| 227 | THICK | Adjectives | 8 | 6 | 2 | 50.0% |
| 228 | THIN | Adjectives | 4 | 3 | 1 | 0.0% |
| 229 | THURSDAY | Days and Time | 12 | 10 | 2 | 50.0% |
| 230 | TIGHT | Adjectives | 8 | 6 | 2 | 100.0% |
| 231 | TIME | Days and Time | 14 | 11 | 3 | 66.7% |
| 232 | TODAY | Days and Time | 12 | 10 | 2 | 50.0% |
| 233 | TOMORROW | Days and Time | 13 | 10 | 3 | 33.3% |
| 234 | TOOL | Home | 14 | 11 | 3 | 66.7% |
| 235 | TRAIN | Means of Transportation | 21 | 17 | 4 | 100.0% |
| 236 | TRAIN STATION | Places | 20 | 16 | 4 | 75.0% |
| 237 | TRAIN TICKET | Means of Transportation | 21 | 17 | 4 | 75.0% |
| 238 | TRANSPORTATION | Means of Transportation | 21 | 17 | 4 | 100.0% |
| 239 | TRUCK | Means of Transportation | 21 | 17 | 4 | 100.0% |
| 240 | TUESDAY | Days and Time | 11 | 9 | 2 | 50.0% |
| 241 | UGLY | Adjectives | 8 | 6 | 2 | 100.0% |
| 242 | UNIVERSITY | Places | 20 | 16 | 4 | 100.0% |
| 243 | WAITER | Jobs | 14 | 11 | 3 | 66.7% |
| 244 | WAR | Society | 14 | 11 | 3 | 100.0% |
| 245 | WARM | Adjectives | 21 | 17 | 4 | 100.0% |
| 246 | WE | Pronouns | 21 | 17 | 4 | 50.0% |
| 247 | WEAK | Adjectives | 8 | 6 | 2 | 100.0% |
| 248 | WEDNESDAY | Days and Time | 14 | 11 | 3 | 100.0% |
| 249 | WEEK | Days and Time | 14 | 11 | 3 | 33.3% |
| 250 | WET | Adjectives | 21 | 17 | 4 | 75.0% |
| 251 | WHITE | Colours | 20 | 16 | 4 | 75.0% |
| 252 | WIDE | Adjectives | 21 | 17 | 4 | 75.0% |
| 253 | WIFE | People | 20 | 16 | 4 | 75.0% |
| 254 | WINDOW | Home | 14 | 11 | 3 | 100.0% |
| 255 | WINTER | Seasons | 14 | 11 | 3 | 100.0% |
| 256 | WOMAN | People | 20 | 16 | 4 | 50.0% |
| 257 | YEAR | Days and Time | 15 | 12 | 3 | 100.0% |
| 258 | YELLOW | Colours | 20 | 16 | 4 | 100.0% |
| 259 | YESTERDAY | Days and Time | 14 | 11 | 3 | 66.7% |
| 260 | YOU | Pronouns | 21 | 17 | 4 | 100.0% |
| 261 | YOU (PLURAL) | Pronouns | 21 | 17 | 4 | 100.0% |
| 262 | YOUNG | Adjectives | 21 | 17 | 4 | 50.0% |

## Overall metrics

| Split | Top-1 | Top-3 | Top-5 | Macro F1 | ECE | ms/sample |
|-------|-------|-------|-------|----------|-----|-----------|
| Validation | 81.34% | 92.25% | 94.72% | 0.801 | 0.0484 | 0.4 |
| Train (overfit check) | 99.27% | 100.00% | 100.00% | 0.993 | 0.0576 | 0.6 |

**Train–val gap (top-1):** 17.93 pp

## Calibration

- Temperature applied: **1.05**
- Mean confidence (val): 0.765 (correct 0.818, wrong 0.536)

## Per-class health (validation)

- Classes below 85% accuracy: **117**
- Classes below 50% accuracy: **22**
- Median per-class accuracy: **100.0%**

### Worst 15 classes

| Class | Acc | Support | Top confusion |
|-------|-----|---------|---------------|
| EXTRA | 0.0% | 5 | — |
| FALL | 0.0% | 2 | — |
| FEMALE | 0.0% | 1 | — |
| NICE | 0.0% | 1 | — |
| RED | 0.0% | 4 | PINK |
| RICH | 0.0% | 1 | — |
| THIN | 0.0% | 1 | — |
| BOY | 25.0% | 4 | GIRL |
| COURT | 25.0% | 4 | EXTRA |
| DRESS | 25.0% | 4 | CLOTHING |
| MOTHER | 25.0% | 4 | WOMAN |
| SMALL LITTLE | 25.0% | 4 | BABY |
| BILL | 33.3% | 3 | — |
| GOD | 33.3% | 3 | — |
| GUN | 33.3% | 3 | — |

### Top 15 confusion pairs

| Count | True | Predicted |
|-------|------|-----------|
| 4 | RED | PINK |
| 3 | DRESS | CLOTHING |
| 2 | SMALL LITTLE | BABY |
| 2 | PARENT | FATHER |
| 2 | NEW | OLD |
| 2 | MOTHER | WOMAN |
| 2 | HELLO | BAD |
| 2 | COURT | EXTRA |
| 2 | BOY | GIRL |
| 2 | BABY | BLUE |
| 1 | YOUNG | SUMMER |
| 1 | YOUNG | SHIRT |
| 1 | YESTERDAY | FRIDAY |
| 1 | WOMAN | WHITE |
| 1 | WOMAN | BLACK |

## Honest limitations

- CRITICAL: 1.0 signers/class — model may have learned a person, not ISL.
- INCLUDE manifest has only 1 unique signer_id — validation is NOT signer-independent.
- 95% headline from ideology may not reflect new signers; wild-test accuracy is unknown.
- Per-class support is low (~16 videos/class) — high variance on rare signs.

## Verdict

**NEEDS WORK** — Val top-1 81.3%, gap 17.9 pp

Artifacts: `ml\eval\ver1_eval_report.json`, confusion matrix PNG, per-class CSV.