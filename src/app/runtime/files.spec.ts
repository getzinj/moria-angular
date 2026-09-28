import type { IFileStore } from './files';
import { BrowserFileStore, MemoryFileStore } from './files';

describe.each([
  [ 'MemoryFileStore', (): IFileStore => new MemoryFileStore() ],
  [ 'BrowserFileStore', (): IFileStore => {
    window.localStorage.clear();

    return new BrowserFileStore(window.localStorage);
  } ],
])('%s', (_name: string, create: () => IFileStore) => {
  let files: IFileStore;

  beforeEach((): void => {
    files = create();
  });

  it('reads back what was written', () => {
    files.write('moriachr.sav', 'line one');

    expect(files.read('MORIACHR.SAV')).toBe('line one');
  });

  it('returns null for a file that does not exist', () => {
    expect(files.read('NOSUCH.DAT')).toBeNull();
  });

  it('deletes a file', () => {
    files.write('MORIATOP.DAT', 'scores');
    files.delete('moriatop.dat');

    expect(files.read('MORIATOP.DAT')).toBeNull();
  });

  it('lists files by their capitalised names', () => {
    files.write('b.sav', '');
    files.write('a.sav', '');

    expect(files.list()).toEqual([ 'A.SAV', 'B.SAV' ]);
  });
});

describe('BrowserFileStore', () => {
  it('leaves storage it does not own alone', () => {
    window.localStorage.clear();
    window.localStorage.setItem('other-app', 'x');

    expect(new BrowserFileStore(window.localStorage).list()).toEqual([]);
  });
});
