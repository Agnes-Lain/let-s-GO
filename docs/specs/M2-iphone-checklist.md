# M2 — iPhone check for the product owner (AC 61)

The computer already checked the board in a web browser (screenshots in `docs/screenshots/M2/`).
A few things can only be checked on a real phone. This takes about 10 minutes.

## Before you start
1. On the computer, in the project folder: `npm ci`, then `npx expo start`.
2. On the iPhone, open **Expo Go** and scan the QR code.
3. In the app, open **Settings** and tap **Board demo (dev)**. You see a 9×9 bamboo board.

Tick each box when it works. If something looks wrong, write one line about what you saw.

## 1. Ghost stone above your finger (9×9)
- [ ] Put your finger on the middle of the board and **keep it down**. A see-through stone (the
      "ghost") and a small label like **E5** appear, and you can still see them next to your finger.
- [ ] Slide your finger slowly. The ghost jumps from point to point with it.
- [ ] Lift your finger. A black stone appears where the ghost was, with a small dot on it
      (the "last move" mark).
- [ ] Put your finger down, slide it off the board, then lift it. **No stone** is played.

## 2. Stone sound and the silent switch
- [ ] Ring mode (switch on the side of the phone **not** showing orange): play a stone. You hear a
      short "click" of a stone on wood.
- [ ] Silent mode (switch showing orange): play a stone. **No sound.**
- [ ] Back in ring mode, tap the **♪** button at the top right to turn it off. Play a stone:
      no sound. Tap **♪** again: the sound is back.

## 3. Reduce Motion makes things instant
1. iPhone **Settings → Accessibility → Motion →** turn **Reduce Motion** on. Go back to Expo Go.
2. Tap the **Capture** chip under the board, then tap the point **C4** (above the white stone).
- [ ] With Reduce Motion **on**: the new stone appears at once and the white stone disappears at
      once (no growing, no fading).
- [ ] Turn Reduce Motion **off** again and repeat (tap **Reset**, then C4): now the stone grows in
      softly and the white stone fades away.

## 4. VoiceOver reads the points
1. iPhone **Settings → Accessibility → VoiceOver →** turn it on (triple-click the side button also
   works if you set it up). With VoiceOver, swipe right to move, double-tap to press.
2. Tap **Reset**, then double-tap **D4** to play black there (four lines from the left, four lines from the bottom).
- [ ] Touch D4 with one finger: VoiceOver says **"D4, black stone, last move"**.
- [ ] Touch an empty point, e.g. E5: VoiceOver says **"E5, empty"** and then how to play there.
- [ ] Double-tap an empty point: a white stone is played and VoiceOver says **"White played …"**.
- [ ] Turn VoiceOver off again.

## 5. Undo and Reset
- [ ] Play three stones. Tap **Undo**: the last stone disappears and it is that player's turn again.
- [ ] Tap **Undo** until it turns grey: the board is empty and Undo can no longer be tapped.
- [ ] Play a few stones, then tap **Reset**: the board is empty and it is **Black to play**.
- [ ] Choose **Forbidden**, tap **A1** (bottom-left corner): a red message explains the forbidden
      point. Tap **Reset**: the message goes away.

## Result
- [ ] Everything above works → reply "M2 iPhone check OK".
- [ ] Something did not work → reply with the number of the step and what you saw.
