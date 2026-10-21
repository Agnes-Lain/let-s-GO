# M5 item 4 — iPhone check for the product owner (Units 12–14)

The computer already walked through the new screens in a web browser (`npm run verify:web:m5e`,
screenshots `docs/screenshots/M5/24-*` … `39-*`). A few things can only be checked on a real phone.
This takes about 15 minutes.

## Before you start
1. On the computer, in the project folder: `npm ci`, then `npx expo start`.
2. On the iPhone, open **Expo Go** and scan the QR code.
3. To reach Units 12–14 quickly, finish Unit 11 with at least one star (or use a phone that already has it).

Tick each box when it works. If something looks wrong, write one line about what you saw.

## 1. Map
- [ ] Units 12 **Territory**, 13 **Counting** and 14 **End of game** appear; Unit 14 has a second row **Review 4**.
- [ ] No unit says **Coming soon**; the footer **More units coming soon** is still at the bottom.

## 2. Marking territory (Unit 12)
- [ ] Tapping an empty point puts a small square on it at once (black for Black, white with a dark
      outline for White); tapping it again removes it. Your finger does not hide the point.
- [ ] Tapping a stone does not mark it; the card says stones are not territory.
- [ ] **Clear** is easy to hit with a thumb and removes every square.
- [ ] After a wrong **Check**, the wrong squares flash red and disappear; the right ones stay.

## 3. Dead stones (Unit 14)
- [ ] Tapping one stone of a wall dims the whole wall with a cross on every stone; tapping it again undoes it.
- [ ] The lonely stone is easy to tap on the 5×5 board.

## 4. Counting pad (Units 13–14, Review 4)
- [ ] The number keys feel like a phone keypad: big enough, no missed taps; **⌫** deletes one digit.
- [ ] On the 7×7 board (Unit 13, exercise 6) small dots appear where you tap and disappear on a second
      tap — the cells are small (41 px): say if the dots land on the wrong point.
- [ ] On the 9×9 board (Review 4, exercise 4) everything fits without scrolling: board, the answer
      row with **⌫** and **Check**, two key rows and the message card.
- [ ] With a larger system text size (Settings → Display → Text Size), the pad and the message are
      still readable and nothing is cut off.

## 5. Sound and motion
- [ ] Marking and counting make no stone sound.
- [ ] With **Reduce Motion** on, nothing pulses except the static rings.
