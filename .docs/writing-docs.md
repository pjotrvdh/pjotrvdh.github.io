---
name: writing-docs
description: How to write and update the .docs wikis (root and per game). Read before adding a doc, extending one, or changing the wiki structure.
---

## When to use this

- You're about to create a file under `.docs/` or `<game>/.docs/`.
- You're adding more than a paragraph to an existing doc.
- You're unsure whether something belongs in `AGENTS.md` or in a `.docs/` folder.

## Where things go

- **`AGENTS.md`** is loaded in every session. Keep it short: structure, commands, core rules and a pointer index to the wikis.
- **`.docs/`** (root) covers the Arcade itself: repository layout, the shared single-file build, DDEV, adding a game.
- **`<game>/.docs/`** covers one game: its rules and how each part of it is meant to work. Start every game wiki with an `index.md` hub that lists its docs.
- A doc describes how things work now. Plans, decisions and analyses belong in PR descriptions or commit messages.

## When to add a doc vs extend one

- **Extend** when it is the same topic and fewer than ~40 new lines.
- **New doc** when it is a different keyword an agent would grep for, or the doc would pass ~250 lines.
- **Never duplicate**: link instead. A stale copy is worse than a missing doc.

## Required structure

```markdown
---
name: kebab-name
description: One sentence. States the topic AND when an agent should read it. <= 140 chars.
---

## When to use this

Bullet triggers: files, functions, task types, keywords.

## <Topic sections>

Terse. Bullets and code over prose. Repo-relative paths.

## Gotchas

Project-specific quirks: anything not obvious from the code.

## See also

- [related doc](./other.md) — one-line hook saying when to follow the link.
```

- `name` is kebab-case and equals the filename without `.md`. Frontmatter has only `name` and `description`.
- `When to use this` and the frontmatter are required; other sections may be renamed or added.

## Voice and style

- English, bullets over paragraphs, no marketing language, no hedging: state the rule.
- Name the file and function a rule lives in (`twistball/src/game/game.js`, `launch()`), and the config file that holds a tunable value instead of repeating numbers everywhere.
- Update the doc in the same change as the code. A wrong doc is worse than no doc.

## Gotchas

- Register every new doc in the index of its wiki (`.docs/index.md` or `<game>/.docs/index.md`); `AGENTS.md` links to those indexes.
- Don't document what the code or the tooling already makes obvious (file names, formatter rules).

## See also

- [index.md](index.md) — the root wiki index.
- [../AGENTS.md](../AGENTS.md) — the always-loaded rules and the pointers to every wiki.
