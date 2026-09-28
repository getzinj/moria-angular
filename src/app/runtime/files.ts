// The VMS files Moria kept, as named text files in browser storage. Each file is one string; the
// port reads and writes whole files, which is all the game ever did with them.
//
//   MORIACHR.DAT  master list of live save files (restoring one strikes it off)
//   MORIATOP.DAT  top twenty scores
//   <name>        a save file, named by the player

export interface IFileStore {
  read(name: string): string | null;
  write(name: string, contents: string): void;
  delete(name: string): void;
  list(): readonly string[];
}

const PREFIX: string = 'moria:file:';


function byName(one: string, other: string): number {
  return one.localeCompare(other);
}


/** VMS file names are case-insensitive, so every name is stored in capitals. */
export function vmsFileName(name: string): string {
  return name.trim().toUpperCase();
}


export class MemoryFileStore implements IFileStore {
  private readonly files: Map<string, string> = new Map<string, string>();


  public read(name: string): string | null {
    return this.files.get(vmsFileName(name)) ?? null;
  }


  public write(name: string, contents: string): void {
    this.files.set(vmsFileName(name), contents);
  }


  public delete(name: string): void {
    this.files.delete(vmsFileName(name));
  }


  public list(): readonly string[] {
    return [ ...this.files.keys() ].sort(byName);
  }

}


export class BrowserFileStore implements IFileStore {

  constructor(private readonly storage: Storage) {
  }


  public read(name: string): string | null {
    return this.storage.getItem(PREFIX + vmsFileName(name));
  }


  public write(name: string, contents: string): void {
    this.storage.setItem(PREFIX + vmsFileName(name), contents);
  }


  public delete(name: string): void {
    this.storage.removeItem(PREFIX + vmsFileName(name));
  }


  public list(): readonly string[] {
    const names: string[] = [];

    for (let slot: number = 0; slot < this.storage.length; slot++) {
      const key: string | null = this.storage.key(slot);

      if ((key != null) && key.startsWith(PREFIX)) {
        names.push(key.substring(PREFIX.length));
      }
    }

    names.sort(byName);

    return names;
  }

}
