declare module "@pdf-lib/fontkit" {
  const fontkit: { create(bytes: Uint8Array): any };
  export default fontkit;
}
