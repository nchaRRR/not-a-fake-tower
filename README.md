# Not a Fake Ad: Tower

The hero-in-the-tower puzzle from those mobile ads, actually playable. A Nimoriq game, the second in the *Not a Fake Ad* series.

Tap a tower: the hero enters its lowest occupied floor. Beat weaker enemies to absorb their power, grow with swords and potions, and beat the boss to clear the level.

## Build

```sh
node scripts/build.mjs        # dist/nfa-tower.html (web preview) and dist/app/index.html (for Capacitor)
```

Three.js is vendored in `vendor/three`; esbuild is the only build tool.

## Levels

Levels are precomputed so phones never run the generator.

```sh
node scripts/levels.mjs 200        # rebuild levels 1-200 → src/levels.json
node scripts/levels.mjs 200 101    # keep 1-100, rebuild 101-200
node scripts/daily.mjs 440         # daily towers from 25 Oct 2026 → src/daily.json
node scripts/balance.mjs           # difficulty report (careful-player win rate per level)
node scripts/test-puzzle.mjs       # rules of the puzzle pieces, fog fairness, order traps, share codes
node scripts/depth.mjs --check     # the greedy bot must lose or miss stars on most levels past 20
```

Rules, solver and generator live in `src/rules.js`. Every level is checked to be solvable, and its difficulty is tuned so a careful random player wins at the target rate for that level (`carefulTarget`). `scripts/levels.mjs` always writes the same file.

Puzzle pieces (each taught on its own level, then mixed in): growing enemies (16), order traps (26), power gates (36), allies (46), fog and the spyglass (56). Every level from 4 on has three goals (beat it plus two of: fewest moves, most power, rescue the princess, no potion, no aids); each goal met is a star, and one run can always meet all three. Fog is fair: the level lists what hides, and `plan(level, { fair: true })` proves it can be won whatever the hidden floors turn out to be.

## Map of the code

| File | What |
|---|---|
| `src/main.js` | Scene, gameplay, screens, shop, boosters, daily tower, treasure tower |
| `src/rules.js` | Rules, solver, level generator, weekly event modifiers |
| `src/worlds.js` | The 8 worlds: colours, weather, creatures |
| `src/events.js` | Weekly events |
| `src/daily.js` | Which daily tower belongs to which day |
| `src/achievements.js`, `src/shop.js` | Goals and shop catalogue |
| `src/ads.js` | Rewarded ads (stand-in today; AdMob goes here) |
| `src/notify.js` | Local notifications (Capacitor Local Notifications plugin) |
| `src/promo.js` | Cross-promotion with Not a Fake Ad |
| `src/i18n.js` | English and Turkish text |

## Not done yet

Real AdMob and purchases. Mobile builds: see MOBIL-YAYIN.md. Privacy and support pages: nimoriq.com/nfa-tower-privacy/ and nimoriq.com/nfa-tower-support/.

© 2026 Nimoriq
