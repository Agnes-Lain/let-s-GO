# Google Play store listing — copy and paste

Source: docs/specs/M6-eas-build.md §8. Lesson topics checked against `docs/CURRICULUM.md` and
`src/lessons/content/` (liberties u02, capture u04, ko u08, counting u13, 9×9 games vs bot levels 1–3 in `app/game`: all in
the app). Copy the text **inside** each grey box (without the ``` lines). Limits are checked by
`__tests__/m6-eas-build-docs.test.ts`.

Play Console menu: **Grow users → Store presence → Main store listing** (add the French and
Chinese translations with **Manage translations → Add your own translations**).

| Field | Value (all languages) |
|---|---|
| Category | Education (教育 / Éducation) |
| Tags (up to 5) | Board, Educational, Strategy |
| Contact email | `<support email>` |
| Privacy policy | `https://agnes-lain.github.io/lets-go-privacy/` |

Graphics in this folder: `icon-512.png` (512×512, app icon), `feature-graphic.png` (1024×500),
phone screenshots `screenshot-*.png` (1080×1920).

## en-US

### App name (max 30)

```text
Let's GO
```

### Short description (max 80)

```text
Learn Go (围棋) from zero with short lessons, a friendly bot and no ads.
```

### Full description (max 4000)

```text
Let's GO teaches Go (围棋 wéiqí) from zero. Each lesson explains one rule — liberties, capture, the ko rule, counting territory — and gives you a few small exercises on a tiny board. Short sessions of three to five minutes.

When a move is not allowed or a try fails, the app tells you why, in plain words. At the end you play full 9×9 games against a gentle practice bot.

Everything works offline. No account, no ads, no tracking. Available in English, 中文 and Français.
```

## zh-CN

### App name (max 30)

```text
Let's GO
```

### Short description (max 80)

```text
从零开始学围棋：短课程、友好的对手、无广告。
```

### Full description (max 4000)

```text
Let's GO 带你从零学围棋。每节课只讲一条规则——气、提子、劫、数子——再配几道小棋盘上的练习，每次三到五分钟。

落子不合规或尝试失败时，应用会用简单的话告诉你原因。最后你可以在 9×9 棋盘上和温和的陪练机器人完整对弈。

全部内容可离线使用，无需账号，无广告，无跟踪。支持中文、English、Français。
```

## fr-FR

### App name (max 30)

```text
Let's GO
```

### Short description (max 80)

```text
Apprenez le Go (围棋) pas à pas : leçons courtes, bot amical, sans pub.
```

### Full description (max 4000)

```text
Let's GO vous apprend le Go (围棋 wéiqí) depuis zéro. Chaque leçon explique une seule règle — libertés, capture, règle du ko, décompte du territoire — puis propose quelques petits exercices sur un mini-plateau. Sessions courtes de trois à cinq minutes.

Quand un coup est interdit ou un essai échoue, l'app explique pourquoi, simplement. À la fin, vous jouez de vraies parties 9×9 contre un robot d'entraînement indulgent.

Tout fonctionne hors ligne. Pas de compte, pas de publicité, pas de suivi. Disponible en français, English et 中文.
```
