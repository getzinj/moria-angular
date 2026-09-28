// Moria's own `exit` procedure ended the whole image from wherever it was called: a successful
// save, quitting at a prompt, a corrupt save file. A throw is the only way to unwind that far.

export class MoriaExit extends Error {

  constructor(public readonly reason: string = 'exit') {
    super(`Moria exited: ${ reason }`);
    this.name = 'MoriaExit';
  }

}
