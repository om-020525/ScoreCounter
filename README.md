# Starpath

A score counter for a 10 vs 10 tabletop game, built as a single static page. No build step, no
dependencies — open `index.html` and play.

## Playing

**Edit mode** is where you add players. Each row can be renamed, given a starting score, dragged into
a new order, or deleted. The tick in the top right leaves edit mode and takes you to the start screen.

**Play mode** runs a round in four phases, advanced with the `Next` button (or `→` / `Enter`):

| Phase | What happens |
| --- | --- |
| Play Fighter | The turn marker walks down the list, one player at a time |
| Play Supporter | Same again |
| Battle Phase | `+` / `−` buttons appear beside every row to adjust scores |
| Assign Coin | Click any coin to hand the leader coin to that player |

Each row carries two squares that fill as that player takes their fighter and supporter turns, and
they reset at the start of the next round.

A round ends after the coin is assigned. The first player to reach 10 spirits rules the universe; if
several are tied at the top, a tie breaker round is played instead. `Surrender` ends the fight
immediately and awards the win on the current scores, or declares a stalemate if they are level.

## Settings

- **Turn order** — `Fixed` keeps your order, `Auto` sorts by score each round behind the coin holder.
  Whoever sits on top when you leave edit mode always receives the coin.
- **Music** — background tracks per phase, with a volume slider. Off by default.
- **Announcements** — a voice line at the start of each phase, with its own volume.

Everything, including the roster and the current round, is kept in `localStorage`.

## Layout

```
index.html    markup, SVG coin faces, settings panel
styles.css    all styling, starfield, coin, animations
app.js        state, rendering, game flow, starfield, audio
Music/        background tracks
Music/Voices/ phase announcements
```

The starfield is drawn entirely in CSS and JavaScript — twelve constellations that drift along
pre-generated wavy loops, with no image assets.

## Hosting on GitHub Pages

Push the repository and turn on Pages under **Settings → Pages**, serving from the root of the
default branch. The site is static, so there is nothing to build. `.nojekyll` is included so Jekyll
leaves the files alone.

The audio is the only heavy part of the project. Tracks use `preload="none"`, so a first visit only
downloads the page and the small voice clips; a music bed is fetched when music is switched on.
