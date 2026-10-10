# CafeAssistent — Conversational Coffee Shop Ordering

A production-grade React Native (Expo) ordering app paired with a Node.js backend, where customers can browse a menu, build a cart through a polished mobile UI, **and** order in plain English via a conversational AI assistant. Natural-language inputs like *"add two large oat lattes, a blueberry muffin, and a sandwich"* are parsed into structured cart actions and applied in real time.

Built for the Viridien take-home assignment. Designed to run identically on **iOS Simulator**, **Android Expo Go**, and **any modern web browser** with zero per-device configuration.

## Table of contents

- [What you get](#what-you-get)
- [High-Level Design (HLD)](#high-level-design-hld)
- [Low-Level Design (LLD)](#low-level-design-lld)
- [Tech stack and why](#tech-stack-and-why)
- [Prerequisites](#prerequisites)
- [Quick start (one command)](#quick-start-one-command)
- [Detailed installation](#detailed-installation)
- [Running the app](#running-the-app)
  - [Option 1 — Web (Chrome)](#option-1--web-chrome-fastest-to-demo)
  - [Option 2 — Android phone via Expo Go](#option-2--android-phone-via-expo-go)
  - [Option 3 — iOS Simulator (Mac only)](#option-3--ios-simulator-mac-only)
- [Switching AI parsers](#switching-ai-parsers)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Design decisions & trade-offs](#design-decisions--trade-offs)
- [Troubleshooting](#troubleshooting)
- [AI tools used to build this](#ai-tools-used-to-build-this)
- [Known limitations & future work](#known-limitations--future-work)

---

## What you get

| Capability | Where it lives | How it works |
|---|---|---|
| Premium mobile UI (dark coffee theme, animations, haptics) | `mobile/app/`, `mobile/src/components/` | NativeWind v4, Reanimated 4, Lucide icons |
| Menu with categories, modifiers, filters | `backend/src/data/menu.ts`, `mobile/app/(tabs)/menu.tsx` | 15-item seed, 5 categories, reusable modifier groups |
| Cart with quantity / modifier editing | `mobile/src/store/cart.ts` | Zustand + AsyncStorage persistence |
| Three interchangeable AI parsers (regex / OpenAI / Claude) | `backend/src/ai/` | Single `ChatRequest → ChatResponse` contract; swap via env var |
| Real-time conversational ordering | `mobile/app/(tabs)/chat.tsx` | Tool calls translated to `CartAction[]` on the client |
| Server-side validation of every AI action | `backend/src/ai/openai.ts`, `anthropic.ts` | Strict id/modifier checks + fuzzy fallback resolution |
| Graceful degradation when AI is off | `backend/src/ai/{openai,anthropic}.ts` | Polite "AI is offline" reply, app keeps working |
| Image error fallbacks | `mobile/src/components/MenuCard.tsx` | Coffee-toned placeholder tile with item name |
| Works on iOS / Android / Web with zero config | `mobile/src/api/client.ts` | Auto-discovers backend host from Expo or `window.location` |

---

## High-Level Design (HLD)

```
                  ┌──────────────────────────────────────────────────┐
                  │  Client (single React Native codebase, 3 targets)│
                  │                                                  │
                  │   iOS Simulator   Android (Expo Go)   Web (RNW)  │
                  └──────────────────────────┬───────────────────────┘
                                             │
                                             │  HTTPS / HTTP (JSON)
                                             │
                                             ▼
                       ┌─────────────────────────────────────────┐
                       │  Backend  (Node.js + Express + TS)      │
                       │                                         │
                       │   GET  /api/menu     →  static seed     │
                       │   POST /api/chat     →  parser strategy │
                       │   GET  /health       →  liveness        │
                       └────────────┬────────────────────────────┘
                                    │
                  ┌─────────────────┼─────────────────────┐
                  │                 │                     │
                  ▼                 ▼                     ▼
        ┌────────────────┐ ┌─────────────────┐ ┌──────────────────┐
        │ Regex parser   │ │ OpenAI parser   │ │ Anthropic parser │
        │ (no API key)   │ │ gpt-4o-mini     │ │ claude-sonnet-4-6│
        │ deterministic  │ │ function-call   │ │ tool-use         │
        └────────────────┘ └─────────────────┘ └──────────────────┘
                  │                 │                     │
                  └─────────────────┼─────────────────────┘
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │  Server-side validator │
                       │  • exact id            │
                       │  • fuzzy resolve       │
                       │  • modifier id check   │
                       └────────────┬───────────┘
                                    │
                                    ▼
                       { reply: string,
                         actions: CartAction[] }
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │  applyActions(client)  │
                       │  → Zustand cart store  │
                       │  → AsyncStorage persist│
                       │  → haptics             │
                       └────────────────────────┘
```

**Key architectural choices and why:**

1. **Cart truth lives on the client.** The backend never holds cart state — it's a stateless parser. This keeps the UI snappy, lets the cart survive offline, eliminates a session-store dependency, and trivially scales the backend horizontally.
2. **AI returns *intents*, not state.** The server returns `CartAction[]` (`add`/`update`/`remove`/`clear`); the client applies them. This means the backend can never desync the cart, and the same actions array can be replayed for testing or audit logging.
3. **Strategy pattern for the parser.** Three implementations of the same `(ChatRequest) => Promise<ChatResponse>` signature; swappable via `PARSER_MODE` env var. Adding a fourth (e.g. Mistral, Gemini) is a 60-line file plus one switch case.
4. **Defense-in-depth on AI output.** Every `add_item` action from the LLM is validated against the live menu — invalid item IDs, unknown modifier groups, or wrong option IDs are dropped server-side. A fuzzy resolver catches reasonable variants ("sandwich" → `avocado-toast`, "chai" → `chai-latte`).
5. **Zero per-machine configuration.** The mobile client auto-discovers the backend URL from `Constants.expoConfig.hostUri` (Expo Go) or `window.location.hostname` (web). No `192.168.x.x` to hardcode, no `.env` to copy. Works the same on any developer's laptop.

---

## Low-Level Design (LLD)

### Type contracts (shared, single source of truth)

The exact same shapes exist in `backend/src/types.ts` and `mobile/src/types.ts`:

```ts
type MenuItem = {
  id: string;            // stable, kebab-case (e.g. "cold-brew")
  name: string;
  description: string;
  basePrice: number;     // integer cents — no float math anywhere
  category: string;
  image: string;         // remote URL with onError fallback
  modifierGroups?: ModifierGroup[];
  tags?: string[];       // e.g. "popular", "new", "vegan-friendly"
};

type ModifierGroup = {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  options: { id: string; name: string; priceDelta: number }[];
};

type CartLine = {
  id: string;            // client-generated, line-stable across mutations
  itemId: string;
  quantity: number;
  modifiers: SelectedModifier[];
  unitPrice: number;     // base + sum(modifier deltas), cached for display
};

type CartAction =
  | { type: 'add'; item_id: string; quantity: number; modifiers?: SelectedModifier[] }
  | { type: 'update'; line_id: string; quantity: number }
  | { type: 'remove'; line_id: string }
  | { type: 'clear' };

type ChatResponse = { reply: string; actions: CartAction[] };
```

### Backend module map

```
backend/src/
├── index.ts                    Express bootstrap, CORS, routes mount
├── types.ts                    Domain types (mirrored in mobile)
├── routes/
│   ├── menu.ts                 GET /api/menu
│   └── chat.ts                 POST /api/chat — zod validation + parser dispatch
├── data/
│   └── menu.ts                 15 items, 5 categories, 5 reusable modifier groups
└── ai/
    ├── client.ts               Lazy Anthropic SDK init
    ├── tools.ts                Anthropic tool schemas (shared shape with OpenAI)
    ├── systemPrompt.ts         Barista persona + decision-tree rules + ID lookup
    ├── regexParser.ts          Tokenizer, fuzzy item match, intent dispatch
    ├── openai.ts               GPT-4o-mini function calling + resolveItem + validate
    └── anthropic.ts            Claude tool use + resolveItem + validate
```

### Mobile module map

```
mobile/
├── app/                        Expo Router file-based routes
│   ├── _layout.tsx             Root Stack, GestureHandler, SafeAreaProvider
│   ├── index.tsx               Redirect / → /menu
│   ├── (tabs)/
│   │   ├── _layout.tsx         Bottom tab bar (Menu / Assistant / Cart) + badge
│   │   ├── menu.tsx
│   │   ├── chat.tsx
│   │   └── cart.tsx
│   └── item/[id].tsx           Item detail with modifier selectors
└── src/
    ├── api/client.ts           fetch wrapper + auto LAN URL resolution
    ├── store/
    │   ├── cart.ts             Zustand store + AsyncStorage persistence
    │   ├── menu.ts             Menu cache + byId lookup
    │   └── chat.ts             Chat history + send() + diagnostic log
    ├── components/             MenuCard (with image fallback), CartLineRow,
    │                           CategoryChips (web-safe flex), ChatBubble,
    │                           ChatInput, ActionChip, SuggestionRow, ...
    ├── lib/
    │   ├── applyActions.ts     CartAction[] → cart-store mutations
    │   ├── format.ts           Integer cents → "$X.XX"
    │   └── cartModSummary.ts   Modifier name flattening for action chips
    └── types.ts                Mirror of backend/src/types.ts
```

### Critical paths

**Adding an item via AI:**

1. User types *"add a large oat latte"* in the Assistant tab.
2. `chat.send()` POSTs `{ messages, cart: { lines } }` to `/api/chat` with full history.
3. Backend dispatches to the parser named by `PARSER_MODE` env var.
4. OpenAI/Anthropic builds a system prompt embedding the live menu + cart, plus a four-case decision tree (menu item → tool-call; off-menu → text; ambiguous → ask; chitchat → reply).
5. The LLM emits one or more `add_item` tool calls.
6. Each tool call passes through `validateAddItem`: tries exact `item_id` → falls back to `resolveItem()` (name match → single-item category match → token overlap) → checks every `group_id` and `option_id` against the actual menu.
7. Invalid actions are dropped with a `(note: …)` appended to the human reply; valid actions go into the response array.
8. Client receives `{ reply, actions }`. The chat bubble renders the reply. `applyActions(actions)` dispatches to the Zustand cart store, fires haptics, and the cart-badge in the tab bar updates immediately.

**Resilience:**

- LLM hallucinates a non-existent item → caught by exact + fuzzy match; if still no hit, the LLM is told (via system prompt) to reply in text, never to fake a confirmation.
- LLM returns no content **and** no tool calls → backend fallback replaces the empty reply with "Hmm, I didn't catch that — could you rephrase?"
- LLM returns valid tool call with invalid modifier → action dropped, note appended.
- Backend down / unreachable → client catches, bubble shows "Sorry — I couldn't reach the assistant. Try again." with `error: true`.
- Image URL 404 → MenuCard shows a coffee-toned tile with the item name (deterministic palette per id, looks intentional).

---

## Tech stack and why

| Layer | Choice | Rationale |
|---|---|---|
| Mobile framework | Expo SDK 54 (RN 0.81, React 19) + TypeScript | One codebase for iOS / Android / Web; faster dev loop than bare RN; SDK 54 ships Reanimated 4 + new architecture |
| Routing | expo-router 6 | File-based, type-safe; trivial deep links and tab bars |
| Styling | NativeWind v4 + Tailwind 3 | Utility classes give premium polish without writing StyleSheets; identical class names work on web via react-native-web |
| State | Zustand + AsyncStorage middleware | Tiny API, no boilerplate, persistence in two lines, ideal for client-side cart truth |
| Icons | lucide-react-native + react-native-svg | Crisp, consistent line icons used throughout |
| Animations | react-native-reanimated 4 + react-native-worklets | UI-thread animations for press-scale and other micro-interactions |
| Backend | Node 20 + Express 4 + TypeScript (ESM) | Idiomatic, minimal dependencies, fast cold start, easy to deploy anywhere |
| Validation | zod | Runtime contract checks on every chat request; clear error messages for bad clients |
| LLM (OpenAI) | gpt-4o-mini via OpenAI SDK | Fast, cheap, supports parallel function calling, reliable for tool-use |
| LLM (Anthropic) | claude-sonnet-4-6 via Anthropic SDK | Excellent structured tool-use, strong adherence to system prompts |
| Dev server | tsx watch | Auto-restart on file change, zero build step in development |

---

## Prerequisites

These are the only things you need on the host machine. **No global packages or platform-specific SDKs required for the web option.**

| Tool | Minimum version | How to check | Required for |
|---|---|---|---|
| Node.js | 20.0+ | `node --version` | All paths |
| npm | 10.0+ | `npm --version` | All paths (ships with Node) |
| Python 3 | 3.8+ | `python3 --version` | Web option's static server (pre-installed on macOS, install on Windows from python.org) |
| Expo Go app (Android) | latest | Play Store | Android phone option |
| Xcode | 15+ | Mac App Store | iOS Simulator option (Mac only) |
| Android Studio | latest | developer.android.com | Android Emulator option (any OS) |
| OpenAI or Anthropic API key | n/a | console.openai.com or console.anthropic.com | LLM parser modes (regex mode needs no key) |

Optional but recommended: `curl` (Mac/Linux ship with it; Windows users can use PowerShell's `Invoke-RestMethod` or install via `winget install curl`).

---

## Quick start (one command)

After cloning the repo:

```bash
cd viridien_assignment

# Mac / Linux
chmod +x run-web.sh run-android.sh
./run-web.sh                    # opens Chrome on http://localhost:5173

# Windows (use Git Bash or WSL, or run the commands manually)
bash run-web.sh
```

That's it. The script:

1. Starts the Node backend on port 3000 (regex mode by default — no API key needed)
2. Builds the static web bundle if not already built (~30 s first time)
3. Serves the bundle on port 5173 with SPA fallback (so `/menu`, `/cart`, etc. work on refresh)
4. Opens Chrome at `http://localhost:5173`
5. Prints your LAN IP so you can open the same URL on your phone

Stop with `Ctrl+C`. Backend continues running; stop it explicitly with `lsof -ti :3000 | xargs kill` (macOS/Linux) or `netstat -ano | findstr :3000` + `taskkill /PID <pid> /F` (Windows).

---

## Detailed installation

### Step 1 — Clone

```bash
git clone <repo-url>
cd viridien_assignment
```

### Step 2 — Backend dependencies

```bash
cd backend
npm install
cp .env.example .env
# .env is gitignored. Edit it now if you want LLM modes:
#   OPENAI_API_KEY=sk-...           (only needed for openai mode)
#   ANTHROPIC_API_KEY=sk-ant-...    (only needed for anthropic mode)
# Leave them blank to run the regex parser — no key required.
```

The backend runs without any API key in regex mode. To use LLM modes, sign up:

- **OpenAI** — [platform.openai.com](https://platform.openai.com) → API keys → create. ~$0.001 per chat in `gpt-4o-mini`.
- **Anthropic** — [console.anthropic.com](https://console.anthropic.com) → API keys → create.

### Step 3 — Mobile dependencies

```bash
cd ../mobile
npm install --legacy-peer-deps
# --legacy-peer-deps is required because NativeWind v4 has a transitive
# peer-conflict with Expo SDK 54. Yarn users: yarn install (yarn handles it).
```

### Step 4 — Verify backend works

```bash
cd ../backend
npm run dev:regex                 # or dev:openai / dev:anthropic
# In another terminal:
curl http://localhost:3000/health
# → {"ok":true,"service":"cafe-ai-backend"}
curl http://localhost:3000/api/menu | head -c 200
```

### Step 5 — Pick a way to view the app

See the next section.

---

## Running the app

### Option 1 — Web (Chrome), fastest to demo

Easiest, no phone or simulator needed. Renders inside a phone-shaped frame on desktop (drops the frame on narrow viewports so real phones see fullscreen).

```bash
cd viridien_assignment
./run-web.sh                  # default regex parser
./run-web.sh openai           # GPT-4o-mini
./run-web.sh anthropic        # Claude
```

The script auto-detects your Mac/Linux LAN IP and prints both URLs:

```
On THIS Mac (Chrome):
  http://localhost:5173

On your ANDROID PHONE (same Wi-Fi):
  http://192.168.1.42:5173
```

Open whichever URL fits. The web bundle auto-discovers the backend at `http://<same-host>:3000`.

### Option 2 — Android phone via Expo Go

The intended mobile experience. Native gestures, smooth animations, real bottom tab bar.

**One-time setup:**

1. On your phone: install **Expo Go** from the Google Play Store.
2. Connect phone to the **same Wi-Fi network** as the host machine.

**Launch:**

```bash
cd viridien_assignment
./run-android.sh              # regex
./run-android.sh openai
./run-android.sh anthropic
```

This starts the backend, runs `expo start --lan --clear`, and prints a QR code. In Expo Go, tap **"Scan QR code"** and point it at the terminal. First bundle download takes 60–90 seconds; subsequent reloads are fast.

In-terminal controls:
- `r` — reload app on phone
- `j` — open React DevTools
- `Ctrl+C` — stop

### Option 3 — iOS Simulator (Mac only)

```bash
cd viridien_assignment/backend && npm run dev:openai &
cd ../mobile && npm run ios
# Or just:  npx expo start  then press 'i'
```

### Option 4 — Android Emulator (any OS)

```bash
# Start Android Studio's AVD first, then:
cd viridien_assignment/backend && npm run dev:openai &
cd ../mobile && npm run android
```

For the Android emulator, the client auto-uses `10.0.2.2:3000` because that's how the AVD reaches the host's localhost. (Actually it uses Expo's `hostUri` which is already the right thing.)

---

## Switching AI parsers

The natural-language parser is chosen at backend startup via the `PARSER_MODE` env var. Three modes are interchangeable behind the same `(messages, cart) => { reply, actions }` contract — you can switch without restarting the mobile app.

| Mode | Command | Needs key | What it is |
|---|---|---|---|
| **regex** (default) | `./run-web.sh` or `./run-android.sh` | No | Deterministic tokenizer + keyword/fuzzy matcher. Handles single-item and many multi-item phrasings. |
| **openai** | `./run-web.sh openai` | `OPENAI_API_KEY` | `gpt-4o-mini` with parallel function calling. Best multi-intent handling. |
| **anthropic** | `./run-web.sh anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` with tool use. Strong adherence to system prompt. |

**Verifying which parser served a request:** every response includes an `X-Parser-Mode` HTTP header. Open Chrome DevTools → Network → click the `/api/chat` request → Response Headers.

**Phrases to try in any mode:**

- *"add two large oat lattes and a blueberry muffin"* (multi-item)
- *"add a sandwich and a hot chocolate"* (category resolution + cross-category)
- *"give me a chai"* (display-name → item_id)
- *"make my latte decaf"* (modify existing line)
- *"remove the muffin"* (remove)
- *"clear my cart"* (clear)
- *"what's popular?"* (recommendation, no cart mutation)
- *"add a water"* (off-menu → polite decline)

---

## API reference

### `GET /health`

Liveness probe. Returns `200`.

```json
{ "ok": true, "service": "cafe-ai-backend" }
```

### `GET /api/menu`

Returns the full menu (categories + items + modifier groups).

```json
{
  "categories": ["Espresso", "Brewed", "Tea & Other", "Pastries", "Sandwiches"],
  "items": [
    {
      "id": "latte",
      "name": "Latte",
      "description": "Espresso layered with velvety steamed milk and a delicate foam crown.",
      "basePrice": 550,
      "category": "Espresso",
      "image": "https://images.unsplash.com/...",
      "modifierGroups": [
        {
          "id": "size",
          "name": "Size",
          "type": "single",
          "required": true,
          "options": [
            { "id": "sm", "name": "Small (8 oz)", "priceDelta": 0 },
            { "id": "md", "name": "Medium (12 oz)", "priceDelta": 50 },
            { "id": "lg", "name": "Large (16 oz)", "priceDelta": 100 }
          ]
        },
        ...
      ],
      "tags": ["popular"]
    },
    ...
  ]
}
```

### `POST /api/chat`

Validates the request with zod, dispatches to the active parser, returns `{ reply, actions }`.

**Request:**

```json
{
  "messages": [
    { "role": "user",      "content": "add a latte" },
    { "role": "assistant", "content": "Going with medium and whole milk!" },
    { "role": "user",      "content": "actually make it large" }
  ],
  "cart": {
    "lines": [
      {
        "id": "ln_abc",
        "itemId": "latte",
        "quantity": 1,
        "modifiers": [
          { "groupId": "size", "optionIds": ["md"] },
          { "groupId": "milk", "optionIds": ["whole"] }
        ],
        "unitPrice": 600
      }
    ]
  }
}
```

**Response:**

```json
{
  "reply": "Bumping it up to large — enjoy!",
  "actions": [
    { "type": "update", "line_id": "ln_abc", "quantity": 1 }
  ]
}
```

**Headers:** `X-Parser-Mode: regex|openai|anthropic`

**Errors:**

- `400` — zod validation failed; body includes `detail` field listing offending fields.
- `500` — parser threw; body includes `detail`, `mode`.

---

## Project structure

```
viridien_assignment/
├── README.md                   This file
├── run-web.sh                  One-command web launcher (any OS via Git Bash)
├── run-android.sh              One-command Android-via-Expo-Go launcher
├── serve-web.py                SPA-aware static file server (used by run-web.sh)
│
├── backend/                    Node + Express + TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example            Copy to .env (gitignored)
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── routes/
│       │   ├── menu.ts
│       │   └── chat.ts
│       ├── data/
│       │   └── menu.ts
│       └── ai/
│           ├── client.ts
│           ├── tools.ts
│           ├── systemPrompt.ts
│           ├── regexParser.ts
│           ├── openai.ts
│           └── anthropic.ts
│
└── mobile/                     Expo (React Native) + TypeScript
    ├── package.json
    ├── tsconfig.json
    ├── babel.config.js
    ├── metro.config.js
    ├── tailwind.config.js
    ├── global.css
    ├── nativewind-env.d.ts
    ├── app.json
    ├── assets/
    ├── app/                    Expo Router pages
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── (tabs)/
    │   │   ├── _layout.tsx
    │   │   ├── menu.tsx
    │   │   ├── chat.tsx
    │   │   └── cart.tsx
    │   └── item/[id].tsx
    └── src/
        ├── types.ts
        ├── api/client.ts
        ├── store/
        │   ├── cart.ts
        │   ├── menu.ts
        │   └── chat.ts
        ├── components/         Pure presentational
        └── lib/                Pure functions
```

---

## Design decisions & trade-offs

### Cart truth on the client, not the server

**Decision:** the backend never stores cart state. The client owns it, persisted in AsyncStorage. The backend's only job is to translate natural language into cart actions.

**Why:**
- Snappier UI — no round-trip for cart-only operations (quantity bumps, modifier toggles).
- Survives offline — open the app on a plane, the cart is intact.
- No session store needed — the backend is stateless and horizontally scalable.
- AI can never desync state — it returns intents that the client applies.

**Cost:** harder to share carts across devices (would need an account system). Out of scope for this assignment.

### Integer cents for all money

All prices are stored as integers (`350` = $3.50). Formatting to strings happens only at the display boundary.

**Why:** avoids floating-point math everywhere (`0.1 + 0.2 !== 0.3`). Common production pattern.

### Strategy pattern for parsers

All three parsers implement `(input) => Promise<{ reply, actions }>`. Switching is a one-line change in `routes/chat.ts` dispatched off `PARSER_MODE`.

**Why:** isolates LLM choice from product code; makes it trivial to add a fourth (Mistral, Gemini, local Llama) or to A/B-test parsers in production.

### Server-side validation of every AI action

Even though the LLM is supposedly tool-using correctly, every `add_item` is re-checked against the live menu in `validateAddItem`:

1. Item ID exists (exact match → fuzzy fallback)
2. Each modifier group ID exists on that item
3. Each option ID exists in that group

Invalid actions are silently dropped with a `(note: …)` in the human reply.

**Why:** never trust LLM output. A prompt-injection or model regression can't corrupt the cart.

### Auto-discovery of backend URL

The mobile client tries, in order:

1. `EXPO_PUBLIC_API_URL` env override
2. `window.location.hostname` (web; if it's a LAN IP, use that for the backend too)
3. `Constants.expoConfig.hostUri` (Expo Go's dev server, gives the LAN IP)
4. `http://localhost:3000` fallback (iOS Simulator, Android Emulator, desktop web on same host)

**Why:** zero per-machine configuration. The repo runs identically on any developer's laptop without editing files.

### NativeWind on web — known footguns we fixed

NativeWind v4 + Expo SDK 54 + react-native-web has two non-obvious issues that we hit and fixed:

1. **`ScrollView` defaults to `flex: 1` on web.** When a sibling `FlatList` has fewer items, the chips row stretches vertically. Fixed in `CategoryChips.tsx` by pinning `flexGrow: 0, flexShrink: 0`.
2. **`Text` with `flex-1` inside a flex-row View with only `maxWidth` (no explicit width) can render at 0 px width.** Fixed in `ChatBubble.tsx` by rendering `Text` directly when there's no sibling icon to flex against.

Both fixes are commented in the source.

### `import.meta` patch in the web bundle

A transitive dependency emits `import.meta.env.MODE` in the production web bundle, but the `<script>` tag isn't loaded as a module — so the browser throws a SyntaxError. The launcher (and the build helper inside it) does a textual `import.meta → ({env:{}})` substitution on the bundled JS as a post-build step. This keeps the runtime behavior identical (`undefined` for `MODE`) without forcing the whole bundle to load as a module (which has CORS and strict-mode implications).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Phone shows "Network response timed out" when scanning QR | Wi-Fi network isolation (corporate / hotel / guest) | Use a personal Wi-Fi or phone hotspot that both Mac and phone join |
| Web bundle in Chrome shows `Unmatched Route` | The static server doesn't fall back to `index.html` for deep links | Use the provided `serve-web.py` (already does SPA fallback). Don't use plain `python -m http.server`. |
| Web bundle in Chrome shows `Cannot use 'import.meta' outside a module` | A dep emits `import.meta` in a non-module bundle | Use the provided `run-web.sh` which auto-patches. If running `expo export` manually, apply the same `import.meta → ({env:{}})` substitution. |
| Chips row distorts on Sandwiches tab in Chrome | `ScrollView` stretches vertically on web (`flex: 1` default) | Already fixed in `CategoryChips.tsx`. If you see it again after edits, restore `flexGrow: 0, flexShrink: 0`. |
| Assistant bubble shows empty even though backend returned text | `Text` with `flex-1` inside a flex-row collapsed to 0 width | Already fixed in `ChatBubble.tsx`. Render `Text` directly when there's no icon sibling. |
| AI replies "AI is offline" | The key for the active mode isn't set | Either fill in `backend/.env`, or switch to regex mode |
| Backend log: `EADDRINUSE` on port 3000 | Another process is using port 3000 | `lsof -ti :3000 \| xargs kill` (Mac/Linux); on Windows use `netstat -ano \| findstr :3000` and `taskkill /PID <pid> /F` |
| macOS firewall blocks phone | System Settings → Network → Firewall | Disable, or click Options and allow incoming for `node` and `python3` |

---

## AI tools used to build this

This project was scaffolded and iterated with **Claude Code** (Anthropic's CLI for agentic coding). Notable techniques:

- **Multi-agent parallelization** — phases with disjoint file scopes (e.g. Cart UI vs Backend AI, Chat UI vs Polish) were implemented by parallel sub-agents working in their own scopes, then merged.
- **Persistent build plan** — a living plan document kept every sub-agent self-contained; the API contract, type definitions, and conventions were referenced from one shared place rather than re-derived.
- **Verification gates per phase** — every phase ended with `tsc --noEmit`, an `expo export` bundle test, and a `curl` smoke test of the API (both happy path and no-key fallback).
- **Defensive iteration** — when issues were discovered in the web/Expo Go runtime (the flex collapse, the import.meta SyntaxError, the ScrollView height bug), Claude Code was used to instrument with diagnostic logs first, then fix once the root cause was confirmed from runtime output.

---

## Known limitations & future work

- **No real payment / order persistence.** The Place Order button shows a confirmation alert; in production this would post to an orders service.
- **Menu seeded in code.** `backend/src/data/menu.ts` would become a database (Postgres) or CMS-backed store in production.
- **Single-turn tool calls.** The LLM produces all tool calls in one response; we don't loop back with tool results. For the use case (cart manipulation, not multi-step reasoning) this is sufficient and faster.
- **Image hosting.** Item images come from Unsplash by URL. A production app would host its own assets on a CDN. The image-error fallback in `MenuCard` covers any 404s in the meantime.
- **No automated tests.** Type-checking (`tsc --noEmit`) and manual smoke testing were used for this take-home. A production codebase would add Jest for the parser logic (especially the fuzzy resolver) and Detox/Maestro for end-to-end mobile flows.
- **No telemetry.** No analytics or error reporting (Sentry, etc.) is wired up; would be a one-package addition.
- **Cart can't be shared across devices.** By design — see the cart-truth-on-client decision. Adding accounts would lift this.
