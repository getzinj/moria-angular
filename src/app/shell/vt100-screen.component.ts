import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import type { EffectCleanupRegisterFn, InputSignal, WritableSignal } from '@angular/core';

import type { IScreenSnapshot, ScreenGrid } from '../runtime/screen-grid';


interface IScreenLine {
  readonly before: string;
  readonly cursor: string;
  readonly after: string;
  readonly hasCursor: boolean;
}


@Component({
  selector: 'moria-vt100-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vt100-screen.component.html',
  styleUrl: './vt100-screen.component.scss',
})
export class Vt100ScreenComponent {
  public readonly screen: InputSignal<ScreenGrid> = input.required<ScreenGrid>();

  protected readonly lines: WritableSignal<readonly IScreenLine[]> = signal<readonly IScreenLine[]>([]);


  constructor() {
    effect((onCleanup: EffectCleanupRegisterFn): void => {
      onCleanup(this.screen().onFlush((snapshot: IScreenSnapshot): void => this.lines.set(this.toLines(snapshot))));
    });
  }


  private toLines(snapshot: IScreenSnapshot): readonly IScreenLine[] {
    return snapshot.rows.map((row: string, index: number): IScreenLine => {
      let line: IScreenLine;

      if (index + 1 === snapshot.cursorRow) {
        const at: number = snapshot.cursorColumn - 1;

        line = { before: row.substring(0, at), cursor: row.charAt(at), after: row.substring(at + 1), hasCursor: true };
      } else {
        line = { before: row, cursor: '', after: '', hasCursor: false };
      }

      return line;
    });
  }

}
