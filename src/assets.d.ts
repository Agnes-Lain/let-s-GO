// Metro resolves audio assets to an asset id (number).
declare module '*.mp3' {
  const source: number;
  export default source;
}
