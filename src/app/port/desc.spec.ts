import { max_objects } from './constants';
import { identify, known1, known2, magic_init, objdes, unquote } from './desc';
import { boot } from './port-fixture';
import { clone } from '../runtime/pascal';
import { g } from './variables';

describe('desc', () => {
  beforeEach((): void => {
    boot();
  });

  describe('magic_init', () => {
    it('gives the same flavours from the same seed', () => {
      magic_init(12345);

      const first: string = g.object_list.slice(1).map((item: { name: string }): string => item.name).join('|');

      boot();
      magic_init(12345);

      expect(g.object_list.slice(1).map((item: { name: string }): string => item.name).join('|')).toBe(first);
    });

    it('fills in every flavour placeholder', () => {
      magic_init(12345);

      const left: string[] = g.object_list.slice(1)
        .map((item: { name: string }): string => item.name)
        .filter((name: string): boolean => /%[CRAWM]|%T\|/.test(name));

      expect(left).toEqual([]);
    });

    it('never reads past the end of a flavour list', () => {
      magic_init(12345);

      expect(g.object_list.slice(1).some((item: { name: string }): boolean => item.name.includes('undefined'))).toBe(false);
    });
  });

  describe('marker removal', () => {
    it('known1 drops the identity marker', () => {
      expect(known1('& Potion~| of Speed')).toBe('& Potion~ of Speed');
    });

    it('known2 drops the pluses marker', () => {
      expect(known2('& Dagger^ (%P2,%P3)')).toBe('& Dagger (%P2,%P3)');
    });

    it('unquote removes a scroll title between ~ and |', () => {
      expect(unquote('& Scroll~ Titled "abra"| of Light')).toBe('& Scroll~ of Light');
    });
  });

  describe('objdes', () => {
    beforeEach((): void => {
      g.inventory[1] = clone(g.object_list[1]);
      g.inventory[1].name = '& Ration~ of Food';
    });

    it('describes one with an article', () => {
      g.inventory[1].number = 1;

      expect(objdes(1, true)).toBe('a Ration of Food.');
    });

    it('describes several with a count and a plural', () => {
      g.inventory[1].number = 5;

      expect(objdes(1, true)).toBe('5 Rations of Food.');
    });

    it('describes none left', () => {
      g.inventory[1].number = 0;

      expect(objdes(1, true)).toBe('no more Rations of Food.');
    });

    it('drops the article without pref', () => {
      g.inventory[1].number = 1;

      expect(objdes(1, false)).toBe('Ration of Food');
    });

    it('uses an before a vowel', () => {
      g.inventory[1].name = '& Apple~';
      g.inventory[1].number = 1;

      expect(objdes(1, true)).toBe('an Apple.');
    });
  });

  describe('identify', () => {
    it('reveals every object of the same kind in the object list', () => {
      const potion: number = g.object_list.findIndex((item: { name: string } | undefined): boolean => item?.name.includes('|') === true);

      identify(g.object_list[potion]);

      expect(g.object_ident[potion]).toBe(true);
    });

    it('leaves max_objects entries in object_ident', () => {
      expect(g.object_ident.length - 1).toBe(max_objects);
    });
  });
});
