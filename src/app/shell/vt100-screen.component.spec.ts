import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { ScreenGrid } from '../runtime/screen-grid';
import { Vt100ScreenComponent } from './vt100-screen.component';

describe('Vt100ScreenComponent', () => {
  let fixture: ComponentFixture<Vt100ScreenComponent>;
  let screen: ScreenGrid;

  beforeEach(async (): Promise<void> => {
    screen = new ScreenGrid();
    screen.putString(3, 5, 'Moria');
    screen.flush();

    fixture = TestBed.createComponent(Vt100ScreenComponent);
    fixture.componentRef.setInput('screen', screen);
    await fixture.whenStable();
  });

  it('renders 24 rows', () => {
    expect(fixture.nativeElement.querySelectorAll('.row').length).toBe(24);
  });

  it('renders what was written', () => {
    expect(fixture.nativeElement.querySelectorAll('.row')[2].textContent).toContain('Moria');
  });

  it('shows the cursor after the last write', () => {
    expect(fixture.nativeElement.querySelectorAll('.row')[2].querySelector('.cursor')).not.toBeNull();
  });

  it('re-renders on flush', async () => {
    screen.putString(10, 1, 'Balrog');
    screen.flush();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.row')[9].textContent).toContain('Balrog');
  });

  it('stops following a screen it has been swapped away from', async () => {
    fixture.componentRef.setInput('screen', new ScreenGrid());
    await fixture.whenStable();
    screen.putString(10, 1, 'Balrog');
    screen.flush();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.row')[9].textContent).not.toContain('Balrog');
  });
});
