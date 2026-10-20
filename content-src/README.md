# Lesson sources with SGF problems

Hand-authored lesson sources for `npm run import:sgf` (spec `docs/specs/M5-sgf-import.md`).
Not bundled with the app: only the generated JSON in `src/lessons/content/` ships.

```
content-src/u10-example.src.json   normal lesson JSON; a "sequence" exercise has "sgf": "e1.sgf"
content-src/u10-example/e1.sgf     the problem (folder named after the lesson id)
```

- `npm run import:sgf` writes `src/lessons/content/<id>.json` (with `"generatedFrom"`). Never edit
  that file by hand: change the source and re-run. Then register the lesson in
  `src/lessons/registry.ts`.
- SGF convention: the first child at each node is the correct line; extra variations at the
  first move are wrong answers (the mistake plus optional scripted replies). Deeper variations,
  passes, `AE` and sizes other than 5, 7, 9 are errors. `C` comments are author notes only.
- A source exercise sets `id`, `type: "sequence"`, `sgf`, `goal`, the text keys
  (`lesson.<lessonId>.<exerciseId>.prompt|hint|explain`) and optional
  `"whyKeys": {"d3": "<key>"}` (the why-text for the wrong move at d3). `size`, `setup`,
  `toPlay`, `line` and `wrong` come from the SGF.
