// The Settings "Stone sound" switch (M6-settings AC 9–10). Its own tiny module so the app can wire
// it at start-up even where tests replace `./sound` with a mock.
let enabled = true;

/** Turns every stone sound on or off; takes effect for the next stone. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function isSoundEnabled(): boolean {
  return enabled;
}
