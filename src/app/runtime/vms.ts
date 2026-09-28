// VMS services the game called that have no browser equivalent, and what stands in for them.

const USERNAME_KEY: string = 'moria:username';
const DEFAULT_USERNAME: string = 'PLAYER';
const USERNAME_LENGTH: number = 12;

/** What LIB$SPAWN reports instead of a DCL subprocess for the `$` command and HELP's spawn. */
export const NO_SUBPROCESS_MESSAGE: string = 'Subprocesses are not available on this system.';


/** JPI$_USERNAME: a 12-character blank-padded name, kept in storage so a player can change it. */
export function get_username(storage: Storage | null): string {
  const stored: string | null = storage?.getItem(USERNAME_KEY) ?? null;
  const name: string = (stored == null) || (stored.trim() === '') ? DEFAULT_USERNAME : stored.trim().toUpperCase();

  return name.padEnd(USERNAME_LENGTH, ' ').substring(0, USERNAME_LENGTH);
}


/** A printed file, handed to the browser as a download. */
export function download_text(name: string, contents: string): void {
  const url: string = URL.createObjectURL(new Blob([ contents ], { type: 'text/plain' }));
  const link: HTMLAnchorElement = document.createElement('a');

  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout((): void => URL.revokeObjectURL(url), 1000);
}
