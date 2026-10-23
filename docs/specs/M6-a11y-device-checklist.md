# M6 Settings, intro and accessibility — phone check for the product owner (ACs 34, 43, 44, 12, 15)

The computer already checked the screens in a web browser at phone size (screenshots 60–82 in
`docs/screenshots/M6/`) and with automatic tests. A screen reader, a real finger and the phone's
own settings can only be tried on a real phone. Allow about 25 minutes. Do the iPhone part first;
the Android part is a shorter repeat of the screen-reader section (only if you have an Android
phone).

## Before you start
1. On the computer, in the project folder: `npm ci`, then `npx expo start`.
2. On the iPhone, open **Expo Go** and scan the QR code.
3. Start from a fresh install so the intro shows: delete Expo Go's data for this app, or in the app
   use **Settings > Erase progress** and then **Settings > Show the intro again**.

Tick each box when it works. If something looks wrong, write one line about what you saw (and on
which language and text size).

## 1. First launch and the intro (AC 34)
- [ ] A fresh install opens the **welcome page** first (title, two short paragraphs, a small board,
      one button **Start learning**). Home does not appear before it.
- [ ] **Skip** (top right) is easy to hit with a thumb and takes you to Home. The intro does not
      come back after you close and reopen the app.
- [ ] Tap **Start learning**: page 2 shows an empty 5×5 board. **Put a finger down on a crossing
      and keep it there**: a faint stone shows under the finger.
- [ ] **Slide the finger to another crossing**: the faint stone moves with it.
- [ ] **Lift the finger**: a black stone is placed on that crossing and a green "well done" line
      shows. Try again: stones alternate white / black.
- [ ] **Put a finger down, slide it off the board, lift**: nothing is placed.
- [ ] Touch a crossing that already has a stone: a short, polite message says why it cannot be used.
- [ ] **Go to lesson 1** works before and after you tried the board. It opens lesson 1; the back
      arrow there goes to Home (not to the intro).
- [ ] French: step 2 shows the whole board and the button without scrolling (iPhone SE size is the
      tightest if you have one).

## 2. Settings (AC 12, 15 and the switches)
Open Home, tap the gear.
- [ ] Order from the top: Language, Sound and motion, Games, Help, Progress, version.
- [ ] Tap the **whole row** of **Stone sound** (not only the little switch): it toggles. With sound
      off, place a stone in lesson 1: no "tock". With sound on: "tock". (Check the phone's silent
      switch is off, otherwise there is never a tock.)
- [ ] **Reduce motion** on: stones appear at once, captured stones vanish at once, the Home module
      arrow turns at once.
- [ ] iPhone **Settings > Accessibility > Motion > Reduce Motion** on, then reopen the app: the
      app's **Reduce motion** row shows **on** and is greyed out with a line explaining why.
      Turn the phone setting off again afterwards.
- [ ] **Atari warnings** off here, then open the 9×9 picker: the same switch is off there.
- [ ] **Language**: pick Français, close the app completely, reopen: Settings and Home are French
      from the first screen. Repeat with 中文 and English; then **Follow device**.
- [ ] **Erase progress**: a sheet asks first; **Keep** is the first, strong button; tapping outside
      the sheet closes it without erasing. After **Erase**, Home shows lesson 1 as Continue with no
      stars, the atari switch and your language are unchanged, and the intro does not reappear.

## 3. Home with modules
- [ ] Three module cards (basics, playing an opponent, how to win). A new learner has module 1 open;
      modules 2 and 3 show a lock and **Locked**. They can still be opened to look; tapping a
      locked lesson only shows a short message.
- [ ] The **Play 9×9** card is under the modules and can be opened from the very first day.
- [ ] A header is easy to tap anywhere across its width (it is tall).

## 4. Larger Text (AC 43)
iPhone **Settings > Accessibility > Display & Text Size > Larger Text**, switch on **Larger
Accessibility Sizes** and drag to the **largest** size. Then reopen the app.
- [ ] **Settings**, **intro step 1 and step 2** and **Home**: everything is readable by scrolling;
      nothing is cut off or drawn over other text; buttons are still reachable.
- [ ] **9×9 game** at the default size plus two steps bigger: the whole board and the **Pass** and
      **Resign** buttons are still on the screen; the text above the board grows only a little
      (it is capped on purpose).
- [ ] A lesson exercise (lesson 1): instruction and feedback card are readable; the board is not
      pushed off the screen.
Put the text size back to normal afterwards.

## 5. VoiceOver on iPhone (AC 44)
Turn on **Settings > Accessibility > VoiceOver** (or triple-click the side button if set up).
- [ ] **Settings**: swipe right through every control. Each is read with its name, role and state,
      for example "Stone sound, switch, on, a small tock when a stone is placed" and "Reduce
      motion, switch, off". Each language row says whether it is selected.
- [ ] Double-tap **Stone sound**: it flips and VoiceOver says the new state.
- [ ] **Erase progress**: VoiceOver stays inside the sheet (swiping never reaches the page behind
      it) and reads the title, the text and the two buttons. After Erase it says "Progress
      erased".
- [ ] **Home**: each module is read like "Module 2, Playing an opponent, Units 6–9, 0 of 6 done,
      locked, button, collapsed". Double-tap opens it and it then says "expanded". A collapsed
      module's lessons cannot be reached.
- [ ] **Intro**: each page reads its title and "Step 1 of 2" when it appears. The demo board is
      announced with its label; double-tapping a crossing places a stone.
- [ ] **Lesson 1, first exercise**: swipe to a crossing; it is read with its name (for example
      "C3, empty"); double-tap it to answer. The feedback ("Correct" or the hint) is read **once**.
- [ ] **9×9 game** (Easy): play one stone. VoiceOver says "Black played E5" **once**, then the
      bot's move ("White played …") **once** — never the same move twice. A capture adds
      "captured N stones" in the same sentence.
- [ ] **After a game, tap Review** and step Next/Previous: each step is read once (known bug, see
      below: it may say the move twice until it is fixed).
- [ ] **Take back** a move: the restored position is not read out as a new move.
- [ ] When the game ends the phone says the game is over / the result **once**.

## 6. TalkBack on Android (AC 44, repeat of section 5)
Turn on TalkBack. Only if you have an Android phone.
- [ ] Settings: every control reachable by swiping, read as for example "Stone sound, switch, on".
- [ ] Reset sheet traps focus; Android **Back** closes it without erasing.
- [ ] Lesson 1 exercise feedback is read once (not twice: no echo from a live region).
- [ ] 9×9 game: each move read once.
- [ ] Android **Back** on intro page 2 returns to page 1; on page 1 it behaves like **Skip**.
- [ ] Android system **Remove animations** on: the app's Reduce motion row shows on and is greyed.

## Known issues from QA (not yet fixed when this list was written)
- The **Review** screen after a game may read each step twice ("White played C2" and "Move 10 of
  10, White at C2").
- On the web version only: the **Stone sound** row does not toggle with the **Space** key (Enter
  works), and a module's open/closed state is not exposed to web screen readers. Phones are not
  affected.
- The **suggested** tag in the 9×9 handicap picker is cut to "suggest…" in English.
