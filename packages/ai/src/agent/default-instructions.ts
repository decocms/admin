export function withDefaultInstructions(instructions: string) {
  return `
  <METADATA>
  <Info>
  This metadata section is not inserted by the user, and contain information that can be used by you if you judge it is relevant.
  </Info>
  <Info>
  Current date: ${new Date().toISOString()}
  </Info>
  </METADATA>
  ${instructions}`;
}
