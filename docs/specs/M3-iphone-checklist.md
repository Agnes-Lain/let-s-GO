# M3 — iPhone check for the product owner (AC 112)

The computer already walked through the whole sample lesson in a web browser (screenshots in
`docs/screenshots/M3/`). A few things can only be checked on a real phone. This takes about
10 minutes.

## Before you start
1. On the computer, in the project folder: `npm ci`, then `npx expo start`.
2. On the iPhone, open **Expo Go** and scan the QR code.
3. The home screen shows the learning path. The first node is **Sample (developer)**.

Tick each box when it works. If something looks wrong, write one line about what you saw.

## 1. Home map
- [ ] At the top: the big **Start learning** card. Below: **Sample (developer)** with a white stone
      and a teal ring, then Units 1–6 greyed out with **Coming soon**.
- [ ] The list scrolls up and down; nothing moves sideways.
- [ ] Tapping a **Coming soon** unit does nothing.

## 2. Explanation (3 slides)
- [ ] Tap **Start learning**. Slide 1 shows a 5×5 board, one white stone with a triangle, and a
      teal dot above it (its last liberty). There is no **Back** button.
- [ ] Tap **Next**. After half a second a black stone appears with a soft "tock" and the white
      stone fades away.
- [ ] Tap **Replay**: the white stone comes back and is captured again.
- [ ] Slide 3: two white stones are captured together. The button says **Start practice**.

## 3. Practice (6 exercises)
- [ ] Exercise 1: put your finger on the board and keep it down. You see a thin **ring**, not a
      stone. Lift it on the empty point above the white stone: green dot and **Correct!**
- [ ] Exercise 3: tap the point two to the left of the white stone (**C3**). The stone is played,
      a red ring appears on it, the message says nothing was captured, and **Try again** resets the
      board. Then capture the white stone.
- [ ] Exercise 5: tap **Yes, at A**. It greys out and the reason appears under the options.
- [ ] Exercise 6: the number chips (0–9) are easy to tap; choose **5**, then **Check**.
- [ ] Tap **✕** in the middle of a set: a sheet asks **Leave practice?**. **Keep going** closes it.
- [ ] Swipe back from the left edge of the screen: the same sheet appears (you do not leave).

## 4. Result and saved progress
- [ ] After exercise 6 tap **Finish**: the stars appear one by one, each with a soft "tock".
- [ ] Tap **Back to map**: the sample now shows your stars and a black stone.
- [ ] Close Expo Go completely (swipe it away), open it again: the stars are still there.

## 5. Reduce Motion
1. iPhone **Settings → Accessibility → Motion →** turn **Reduce Motion** on. Go back to Expo Go.
- [ ] In the explanation, slide 2 shows the final position at once (no waiting, no fade).
- [ ] On the result screen all stars appear at once.
2. Turn **Reduce Motion** off again.

## 6. VoiceOver (optional, 2 minutes)
- [ ] With VoiceOver on, each new slide is read aloud ("Step 2 of 3 …"), and after an answer the
      feedback sentence is read.
