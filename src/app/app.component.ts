import { ChangeDetectionStrategy, Component, afterNextRender } from '@angular/core';

import { RealClock } from './runtime/clock';
import { BrowserFileStore } from './runtime/files';
import { Keyboard } from './runtime/keyboard';
import { Random } from './runtime/random';
import type { IRuntime } from './runtime/runtime';
import { ScreenGrid } from './runtime/screen-grid';
import { Terminal } from './runtime/terminal';
import { download_text, get_username } from './runtime/vms';
import { commandLineOf, playForever } from './shell/game-session';
import { vt100KeyOf } from './shell/key-mapping';
import { Vt100ScreenComponent } from './shell/vt100-screen.component';


@Component({
  selector: 'moria-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ Vt100ScreenComponent ],
  host: {
    '(window:keydown)': 'onKey($event)',
  },
  template: '<moria-vt100-screen [screen]="screen" />',
  styles: [ ':host { display: block; width: 100%; }' ],
})
export class AppComponent {
  public readonly screen: ScreenGrid = new ScreenGrid();

  private readonly keyboard: Keyboard = new Keyboard();


  constructor() {
    afterNextRender((): void => {
      const runtime: IRuntime = {
        random: new Random(),
        terminal: new Terminal(this.screen, this.keyboard),
        clock: new RealClock(),
        files: new BrowserFileStore(localStorage),
        username: get_username(localStorage),
        download: download_text,
      };

      void playForever(runtime, commandLineOf(location.search));
    });
  }


  public onKey(event: KeyboardEvent): void {
    const key: string | null = vt100KeyOf(event);

    if (key != null) {
      event.preventDefault();
      this.keyboard.push(key);
    }
  }

}
