// source/include/store2.inc: the shop screen, haggling, buying and selling.

import { inven_max } from './constants';
import { objdes } from './desc';
import { clear, erase_line, get_com, get_string, inkey, msg_print, prt, put_buffer } from './io';
import { chr_adj, draw_cave, insert_num, inven_carry, inven_check_num, inven_check_weight, inven_destroy, randint } from './misc';
import { get_item, inven_command } from './moria';
import { item_value, sell_price, store_carry, store_check_num, store_destroy } from './store1';
import type { inven_record, owner_type, store_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, fmt, read_integer, real, worlint_of } from '../runtime/pascal';

const DONE: readonly string[] = [
  'Done!',
  'Accepted!',
  'Fine...',
  'Agreed!',
  'Ok...',
  'Taken!',
  'You drive a hard bargin, but taken...',
  'You\'ll force me bankrupt, but it\'s a deal...',
  'Sigh...  I\'ll take it...',
  'My poor sick children may starve, but done!',
  'Finally!  I accept...',
  'Robbed again...',
  'A pleasure to do business with you!',
  'My spouse shall skin me, but accepted.',
];

const ASKING_FINAL: readonly string[] = [
  '%A2 is my final offer; take it or leave it...',
  'I\'ll give you no more than %A2.',
  'My patience grows thin...  %A2 is final.',
];

const ASKING: readonly string[] = [
  '%A1 for such a fine item?  HA!  No less than %A2.',
  '%A1 is an insult!  Try %A2 gold pieces...',
  '%A1???  Thou would rob my poor starving children?',
  'Why I\'ll take no less than %A2 gold pieces.',
  'Ha!  No less than %A2 gold pieces.',
  'Thou blackheart!  No less than %A2 gold pieces.',
  '%A1 is far too little, how about %A2?',
  'I paid more than %A1 for it myself, try %A2.',
  '%A1?  Are you mad???  How about %A2 gold pieces?',
  'As scrap this would bring %A1.  Try %A2 in gold.',
  'May fleas of a 1000 orcs molest you.  I want %A2.',
  'My mother you can get for %A1, this costs %A2.',
  'May your chickens grow lips.  I want %A2 in gold!',
  'Sell this for such a pittance.  Give me %A2 gold.',
  'May the Balrog find you tasty!  %A2 gold pieces?',
  'Your mother was a Troll!  %A2 or I\'ll tell...',
];

const OFFERING_FINAL: readonly string[] = [
  'I\'ll pay no more than %A1; take it or leave it.',
  'You\'ll get no more than %A1 from me...',
  '%A1 and that\'s final.',
];

const OFFERING: readonly string[] = [
  '%A2 for that piece of junk?  No more than %A1',
  'For %A2 I could own ten of those.  Try %A1.',
  '%A2?  NEVER!  %A1 is more like it...',
  'Let\'s be resonable... How about %A1 gold pieces?',
  '%A1 gold for that junk, no more...',
  '%A1 gold pieces and be thankful for it!',
  '%A1 gold pieces and not a copper more...',
  '%A2 gold?  HA!  %A1 is more like it...',
  'Try about %A1 gold...',
  'I wouldn\'t pay %A2 for your children, try %A1.',
  '*CHOKE* For that!?  Let\'s say %A1.',
  'How about %A1.',
  'That looks war surplus!  Say %A1 gold.',
  'I\'ll buy it as scrap for %A1.',
  '%A2 is too much, let us say %A1 gold.',
];

const KICKED_OUT: readonly (readonly [ string, string ])[] = [
  [ 'ENOUGH!  Thou hath abused me once too often!', 'Out of my place!' ],
  [ 'THAT DOES IT!  You shall waste my time no more!', 'out... Out... OUT!!!' ],
  [ 'This is getting no where...  I\'m going home!', 'Come back tomorrow...' ],
  [ 'BAH!  No more shall you insult me!', 'Leave my place...  Begone!' ],
  [ 'Begone!  I have had enough abuse for one day.', 'Come back when thou art richer...' ],
];

const INSULTED: readonly string[] = [
  'You will have to do better than that!',
  'That\'s an insult!',
  'Do you wish to do business or not?',
  'Hah!  Try again...',
  'Ridiculus!',
  'You\'ve got to be kidding!',
  'You better be kidding!!',
  'You try my patience.',
  'I don\'t hear you.',
  'Hmmm, nice weather we\'re having...',
];

const MISHEARD: readonly string[] = [
  'I must of heard you wrong...',
  'What was that?',
  'I\'m sorry, say that again...',
  'What did you say?',
  'Sorry, what was that again?',
];


function pick(comments: readonly string[]): string {
  return comments[randint(comments.length) - 1];
}


// store2.inc:3 prt_comment1: haggling is over.
async function prt_comment1(): Promise<void> {
  g.msg_flag = false;
  await msg_print(pick(DONE));
}


async function say_numbers(comment: string, offer: number, asking: number): Promise<void> {
  await msg_print(insert_num(insert_num(comment, '%A1', offer, false), '%A2', asking, false));
}


// store2.inc:25 prt_comment2: the shopkeeper's counter to an offer to buy.
async function prt_comment2(offer: number, asking: number, final: number): Promise<void> {
  await say_numbers(pick(final > 0 ? ASKING_FINAL : ASKING), offer, asking);
}


// store2.inc:59 prt_comment3: the shopkeeper's counter to an asking price.
async function prt_comment3(offer: number, asking: number, final: number): Promise<void> {
  await say_numbers(pick(final > 0 ? OFFERING_FINAL : OFFERING), offer, asking);
}


// store2.inc:93 prt_comment4: thrown out.
async function prt_comment4(): Promise<void> {
  const [ first, second ]: readonly [ string, string ] = KICKED_OUT[randint(5) - 1];

  g.msg_flag = false;
  await msg_print(first);
  await msg_print(second);
  await msg_print(' ');
  g.msg_flag = false;
}


// store2.inc:126 prt_comment5
async function prt_comment5(): Promise<void> {
  await msg_print(pick(INSULTED));
}


// store2.inc:143 prt_comment6
async function prt_comment6(): Promise<void> {
  await msg_print(pick(MISHEARD));
}


// store2.inc:156 display_commands
function display_commands(): void {
  prt('You may:', 21, 1);
  prt(' p) Purchase an item.           b) Browse store\'s inventory.', 22, 1);
  prt(' s) Sell an item.               i) Inventory and Equipment Lists.', 23, 1);
  prt('^Z) Exit from Building.        ^R) Redraw the screen.', 24, 1);
}


// store2.inc:166 haggle_commands
function haggle_commands(typ: number): void {
  if (typ === -1) {
    prt('Specify an asking-price in gold pieces.', 22, 1);
  } else {
    prt('Specify an offer in gold pieces.', 22, 1);
  }

  prt('^Z) Quit Haggeling.', 23, 1);
  prt('', 24, 1);
}


// The price shown for a stock slot: a haggled price with charisma's markup, or a fixed one.
function shown_cost(scost: number): string {
  let result: string;

  if (scost < 0) {
    const i2: number = Math.abs(scost);

    result = fmt(i2 + Math.trunc(real(i2 * chr_adj())), 6);
  } else {
    result = `${ fmt(scost, 6) } [Fixed]`;
  }

  return result;
}


// store2.inc:178 display_inventory: the page of twelve holding start, from start on.
function display_inventory(store_num: number, first: number): void {
  const shop: store_type = g.store[store_num];
  let start: number = first;
  let i1: number = (start - 1) % 12;
  let stop: number = (Math.trunc((start - 1) / 12) + 1) * 12;

  if (stop > shop.store_ctr) {
    stop = shop.store_ctr;
  }

  while (start <= stop) {
    g.inventory[inven_max] = clone(shop.store_inven[start].sitem);

    const shown: treasure_type = g.inventory[inven_max];

    if ((shown.subval > 255) && (shown.subval < 512)) {
      shown.number = 1;
    }

    prt(`${ String.fromCharCode(97 + i1) }) ${ objdes(inven_max, true) }`, i1 + 6, 1);
    prt(shown_cost(shop.store_inven[start].scost), i1 + 6, 60);
    i1++;
    start++;
  }

  if (i1 < 12) {
    for (let i2: number = 1; i2 <= 12 - i1 + 1; i2++) {
      prt('', i2 + i1 + 5, 1);
    }
  }
}


// store2.inc:217 display_cost
function display_cost(store_num: number, pos: number): void {
  prt(shown_cost(g.store[store_num].store_inven[pos].scost), ((pos - 1) % 12) + 6, 60);
}


// store2.inc:239 store_prt_gold
function store_prt_gold(): void {
  prt(`Gold Remaining : ${ fmt(g.py.misc.au, 1) }`, 19, 18);
}


// store2.inc:249 display_store
function display_store(store_num: number, cur_top: number): void {
  clear(1, 1);
  prt(g.owners[g.store[store_num].owner].owner_name, 4, 10);
  prt('   Item', 5, 1);
  prt('Asking Price', 5, 61);
  store_prt_gold();
  display_commands();
  display_inventory(store_num, cur_top);
}


// store2.inc:265 get_store_item: a letter from i1 to i2; false on ^Z, ESC and the like.
async function get_store_item(com_val: IRef<number>, pmt: string, i1: number, i2: number): Promise<boolean> {
  const out_val: string = `(Items ${ String.fromCharCode(i1 + 96) }-${ String.fromCharCode(i2 + 96) }, ^Z to exit) ${ pmt }`;
  const command: IRef<string> = box('');
  let flag: boolean = true;

  com_val.set(0);

  while (((com_val.get() < i1) || (com_val.get() > i2)) && flag) {
    prt(out_val, 1, 1);
    await inkey(command);
    com_val.set(command.get().charCodeAt(0));

    if ([ 3, 25, 26, 27 ].includes(com_val.get())) {
      flag = false;
    } else {
      com_val.set(com_val.get() - 96);
    }
  }

  g.msg_flag = false;
  erase_line(g.msg_line, g.msg_line);

  return flag;
}


// store2.inc:295 increase_insults: true when the owner has had enough and shuts the shop.
async function increase_insults(store_num: number): Promise<boolean> {
  const shop: store_type = g.store[store_num];
  let result: boolean = false;

  shop.insult_cur++;

  if (shop.insult_cur > g.owners[shop.owner].insult_max) {
    await prt_comment4();
    shop.insult_cur = 0;
    shop.store_open = worlint_of(g.turn + 2500 + randint(2500));
    result = true;
  }

  return result;
}


// store2.inc:313 decrease_insults
function decrease_insults(store_num: number): void {
  const shop: store_type = g.store[store_num];

  shop.insult_cur = Math.max(shop.insult_cur - 2, 0);
}


// store2.inc:324 haggle_insults
async function haggle_insults(store_num: number): Promise<boolean> {
  let result: boolean = false;

  if (await increase_insults(store_num)) {
    result = true;
  } else {
    await prt_comment5();
  }

  return result;
}


// store2.inc:341 get_haggle: a number from the player; false when they quit. What won't read as
// a number leaves the last reading, as READV with error:=continue does, and asks again while 0.
async function get_haggle(comment: string, num: IRef<number>): Promise<boolean> {
  const out_val: IRef<string> = box('');
  const clen: number = comment.length + 1;
  let flag: boolean = true;
  let i1: number = 0;

  do {
    await msg_print(comment);
    g.msg_flag = false;

    if (!await get_string(out_val, 1, clen, 40)) {
      flag = false;
      erase_line(g.msg_line, g.msg_line);
    }

    i1 = read_integer(out_val.get(), i1);
  } while (!((i1 !== 0) || !flag));

  if (flag) {
    num.set(i1);
  }

  return flag;
}


// store2.inc:333 recieve_offer: 0 for an offer on the right side of the last, 1 when the player
// quits, 2 when the owner throws them out.
async function recieve_offer(store_num: number, comment: string, new_offer: IRef<number>, last_offer: number, factor: number): Promise<number> {
  let result: number = 0;
  let flag: boolean = false;

  do {
    if (await get_haggle(comment, new_offer)) {
      if (new_offer.get() * factor >= last_offer * factor) {
        flag = true;
      } else if (await haggle_insults(store_num)) {
        result = 2;
        flag = true;
      }
    } else {
      result = 1;
      flag = true;
    }
  } while (!flag);

  return result;
}


// The owner moves part of the way toward the player's offer: x1 is how far the player moved.
function concession(x1_in: number, max_per: number): number {
  let x1: number = x1_in;

  if (x1 > max_per) {
    x1 = real(x1 * real(0.75));

    if (x1 < max_per) {
      x1 = max_per;
    }
  }

  return real(x1 + real((randint(5) - 3) / real(100.0)));
}


interface IHaggle {
  store_num: number;
  result: number;
  price: number;
  flag: boolean;
  cur_ask: number;
  final_ask: number;
  final_flag: number;
  last_offer: number;
  new_offer: IRef<number>;
  comment: string;
  min_per: number;
  max_per: number;
}


// One offer inside a haggle; true when it ended the haggle or stands (loop_flag).
async function take_offer(h: IHaggle, prompt: string, factor: number): Promise<boolean> {
  let loop_flag: boolean = true;

  put_buffer(`${ h.comment }${ fmt(h.cur_ask, 1) }`, 2, 1);

  const answer: number = await recieve_offer(h.store_num, prompt, h.new_offer, h.last_offer, factor);

  if (answer === 1 || answer === 2) {
    h.result = answer;
    h.flag = true;
  } else if (h.new_offer.get() * factor > h.cur_ask * factor) {
    await prt_comment6();
    loop_flag = false;
  } else if (h.new_offer.get() === h.cur_ask) {
    h.flag = true;
    h.price = h.new_offer.get();
  }

  return loop_flag;
}


// When the asking price has reached its floor: after the fourth final offer the haggle ends.
async function final_offer(h: IHaggle): Promise<void> {
  h.cur_ask = h.final_ask;
  h.comment = 'Final Offer : ';
  h.final_flag++;

  if (h.final_flag > 3) {
    h.result = (await increase_insults(h.store_num)) ? 2 : 1;
    h.flag = true;
  }
}


// store2.inc:388 purchase_haggle: 0 with price set on a deal, 1 when the player quits, 2 when thrown out.
async function purchase_haggle(store_num: number, price: IRef<number>, item: treasure_type): Promise<number> {
  const owner: owner_type = g.owners[g.store[store_num].owner];
  const max_sell: IRef<number> = box(0);
  const min_sell: IRef<number> = box(0);

  price.set(0);
  g.msg_flag = false;

  const cost: number = sell_price(store_num, max_sell, min_sell, item);

  max_sell.set(max_sell.get() + Math.trunc(real(max_sell.get() * chr_adj())));

  if (max_sell.get() < 0) {
    max_sell.set(1);
  }

  min_sell.set(min_sell.get() + Math.trunc(real(min_sell.get() * chr_adj())));

  if (min_sell.get() < 0) {
    min_sell.set(1);
  }

  const max_buy: number = Math.trunc(real(cost * real(1 - owner.max_inflate)));
  const h: IHaggle = {
    store_num,
    result: 0,
    price: 0,
    flag: false,
    cur_ask: max_sell.get(),
    final_ask: min_sell.get(),
    final_flag: 0,
    last_offer: max_buy,
    new_offer: box(0),
    comment: 'Asking : ',
    min_per: owner.haggle_per,
    max_per: real(owner.haggle_per * real(3.0)),
  };

  haggle_commands(1);

  do {
    let stands: boolean;

    do {
      stands = await take_offer(h, 'What do you offer? ', 1);
    } while (!(h.flag || stands));

    if (!h.flag) {
      await purchase_step(h);
    }
  } while (!h.flag);

  prt('', 2, 1);
  display_commands();
  price.set(h.price);

  return h.result;
}


async function purchase_step(h: IHaggle): Promise<void> {
  const new_offer: number = h.new_offer.get();
  const x1: number = real((new_offer - h.last_offer) / (h.cur_ask - h.last_offer));

  if (x1 < h.min_per) {
    h.flag = await haggle_insults(h.store_num);

    if (h.flag) {
      h.result = 2;
    }
  } else {
    const x2: number = concession(x1, h.max_per);
    const x3: number = Math.trunc(real((h.cur_ask - new_offer) * x2)) + 1;

    h.cur_ask -= x3;

    if (h.cur_ask < h.final_ask) {
      await final_offer(h);
    } else if (new_offer >= h.cur_ask) {
      h.flag = true;
      h.price = new_offer;
    }

    if (!h.flag) {
      h.last_offer = new_offer;
      prt('', 2, 1);
      put_buffer(`Your last offer : ${ fmt(h.last_offer, 1) }`, 2, 40);
      await prt_comment2(h.last_offer, h.cur_ask, h.final_flag);
    }
  }
}


// store2.inc:506 sell_haggle: as purchase_haggle, and 3 when the item is worthless.
async function sell_haggle(store_num: number, price: IRef<number>, item: treasure_type): Promise<number> {
  const owner: owner_type = g.owners[g.store[store_num].owner];
  let cost: number = item_value(item);
  let result: number = 0;

  price.set(0);
  g.msg_flag = false;

  if (cost < 1) {
    result = 3;
  } else {
    cost = cost - Math.trunc(real(cost * chr_adj())) - Math.trunc(real(cost * g.rgold_adj[owner.owner_race][g.py.misc.prace]));

    if (cost < 1) {
      cost = 1;
    }

    const h: IHaggle = await open_sale(store_num, owner, cost);

    do {
      let stands: boolean;

      do {
        stands = await take_offer(h, 'What price do you ask? ', -1);
      } while (!(h.flag || stands));

      if (!h.flag) {
        await sell_step(h);
      }
    } while (!h.flag);

    prt('', 2, 1);
    display_commands();
    price.set(h.price);
    result = h.result;
  }

  return result;
}


async function open_sale(store_num: number, owner: owner_type, cost: number): Promise<IHaggle> {
  const max_sell: number = Math.trunc(real(cost * real(1 + owner.max_inflate)));
  const max_buy: number = Math.trunc(real(cost * real(1 - owner.max_inflate)));
  const max_gold: number = owner.max_cost;
  let min_buy: number = Math.trunc(real(cost * real(1 - owner.min_inflate)));
  const h: IHaggle = {
    store_num,
    result: 0,
    price: 0,
    flag: false,
    cur_ask: 0,
    final_ask: 0,
    final_flag: 0,
    last_offer: max_sell,
    new_offer: box(0),
    comment: '',
    min_per: owner.haggle_per,
    max_per: real(owner.haggle_per * real(3.0)),
  };

  if (min_buy < max_buy) {
    min_buy = max_buy;
  }

  haggle_commands(-1);

  if (max_buy > max_gold) {
    h.final_flag = 1;
    h.comment = 'Final offer : ';
    h.cur_ask = max_gold;
    h.final_ask = max_gold;
    await msg_print('I am sorry, but I have not the money to afford such a fine item.');
    await msg_print(' ');
  } else {
    h.cur_ask = max_buy;
    h.final_ask = Math.min(min_buy, max_gold);
    h.comment = 'Offer : ';
  }

  if (h.cur_ask < 1) {
    h.cur_ask = 1;
  }

  return h;
}


async function sell_step(h: IHaggle): Promise<void> {
  const new_offer: number = h.new_offer.get();

  g.msg_flag = false;

  const x1: number = real((h.last_offer - new_offer) / (h.last_offer - h.cur_ask));

  if (x1 < h.min_per) {
    h.flag = await haggle_insults(h.store_num);

    if (h.flag) {
      h.result = 2;
    }
  } else {
    const x2: number = concession(x1, h.max_per);
    const x3: number = Math.trunc(real((new_offer - h.cur_ask) * x2)) + 1;

    h.cur_ask += x3;

    if (h.cur_ask > h.final_ask) {
      await final_offer(h);
    } else if (new_offer <= h.cur_ask) {
      h.flag = true;
      h.price = new_offer;
    }

    if (!h.flag) {
      h.last_offer = new_offer;
      prt('', 2, 1);
      put_buffer(`Your last bid   : ${ fmt(h.last_offer, 1) }`, 2, 40);
      await prt_comment3(h.cur_ask, h.last_offer, h.final_flag);
    }
  }
}


// store2.inc:656 store_purchase: true when the owner throws the player out.
async function store_purchase(store_num: number, cur_top: IRef<number>): Promise<boolean> {
  const shop: store_type = g.store[store_num];
  const item_val: IRef<number> = box(0);
  let result: boolean = false;
  let i1: number;

  if (cur_top.get() === 13) {
    i1 = shop.store_ctr - 12;
  } else if (shop.store_ctr > 12) {
    i1 = 12;
  } else {
    i1 = shop.store_ctr;
  }

  if (shop.store_ctr < 1) {
    await msg_print('I am currently out of stock.');
  } else if (await get_store_item(item_val, 'Which item are you interested in? ', 1, i1)) {
    const slot: number = item_val.get() + cur_top.get() - 1;
    const wanted: treasure_type = clone(shop.store_inven[slot].sitem);
    let save_number: number = 1;

    if ((wanted.subval > 255) && (wanted.subval < 512)) {
      save_number = wanted.number;
      wanted.number = 1;
    }

    g.inventory[inven_max] = wanted;

    if (!inven_check_weight()) {
      prt('You can not carry that much weight.', 1, 1);
    } else if (!inven_check_num()) {
      prt('You cannot carry that many different items.', 1, 1);
    } else {
      result = await buy(store_num, slot, save_number, cur_top);
      prt('', 2, 1);
    }
  }

  return result;
}


async function buy(store_num: number, slot: number, save_number: number, cur_top: IRef<number>): Promise<boolean> {
  const price: IRef<number> = box(0);
  let choice: number;
  let result: boolean = false;

  if (g.store[store_num].store_inven[slot].scost > 0) {
    price.set(g.store[store_num].store_inven[slot].scost);
    choice = 0;
  } else {
    choice = await purchase_haggle(store_num, price, clone(g.inventory[inven_max]));
  }

  if (choice === 0) {
    if (g.py.misc.au >= price.get()) {
      await pay(store_num, slot, save_number, price.get(), cur_top);
    } else if (await increase_insults(store_num)) {
      result = true;
    } else {
      await prt_comment1();
      await msg_print('Liar!  You have not the gold!');
    }
  } else if (choice === 2) {
    result = true;
  }

  return result;
}


async function pay(store_num: number, slot: number, save_number: number, price: number, cur_top: IRef<number>): Promise<void> {
  const item_new: IRef<number> = box(0);

  await prt_comment1();
  decrease_insults(store_num);
  g.py.misc.au -= price;
  store_destroy(store_num, slot, true);
  inven_carry(item_new);
  await msg_print(`You have ${ objdes(item_new.get(), true) } (${ String.fromCharCode(item_new.get() + 96) })`);

  if (cur_top.get() > g.store[store_num].store_ctr) {
    cur_top.set(1);
    display_inventory(store_num, cur_top.get());
  } else if (save_number > 1) {
    const left: inven_record = g.store[store_num].store_inven[slot];

    if (left.scost < 0) {
      left.scost = price;
      display_cost(store_num, slot);
    }
  } else {
    display_inventory(store_num, slot);
  }

  store_prt_gold();
}


// store2.inc:758 store_sell: true when the owner throws the player out.
async function store_sell(store_num: number, cur_top: number): Promise<boolean> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);
  let result: boolean = false;

  if (await get_item(item_val, 'Which one? ', redraw, 1, g.inven_ctr)) {
    if (redraw.get()) {
      display_store(store_num, cur_top);
    }

    g.inventory[inven_max] = clone(g.inventory[item_val.get()]);

    const offered: treasure_type = g.inventory[inven_max];

    if ((offered.subval > 255) && (offered.subval < 512)) {
      offered.number = 1;
    }

    await msg_print(`Selling ${ objdes(inven_max, true) } (${ String.fromCharCode(item_val.get() + 96) })`);
    await msg_print(' ');

    if (!g.store_buy[store_num].has(g.inventory[inven_max].tval)) {
      prt('I do not buy such items.', 1, 1);
    } else if (store_check_num(store_num)) {
      result = await sell(store_num, item_val.get(), cur_top);
    } else {
      prt('I have not the room in my store to keep it...', 1, 1);
    }
  } else if (redraw.get()) {
    display_store(store_num, cur_top);
  }

  return result;
}


async function sell(store_num: number, item_val: number, cur_top: number): Promise<boolean> {
  const price: IRef<number> = box(0);
  const choice: number = await sell_haggle(store_num, price, clone(g.inventory[inven_max]));
  let result: boolean = false;

  if (choice === 0) {
    const item_pos: IRef<number> = box(0);

    await prt_comment1();
    g.py.misc.au += price.get();
    inven_destroy(item_val);
    store_carry(store_num, item_pos);

    if (item_pos.get() > 0) {
      if (item_pos.get() < 13) {
        display_inventory(store_num, cur_top < 13 ? item_pos.get() : cur_top);
      } else if (cur_top > 12) {
        display_inventory(store_num, item_pos.get());
      }
    }

    store_prt_gold();
  } else if (choice === 2) {
    result = true;
  } else if (choice === 3) {
    await msg_print('How dare you!');
    await msg_print('I will not buy that!');
    result = await increase_insults(store_num);
  }

  return result;
}


async function pack_command(store_num: number, cur_top: number, command: string): Promise<void> {
  if (await inven_command(command, 0, 0)) {
    display_store(store_num, cur_top);
  }
}


// b: the other page of twelve.
function browse(store_num: number, cur_top: IRef<number>): void {
  if (cur_top.get() === 1) {
    if (g.store[store_num].store_ctr > 12) {
      cur_top.set(13);
      display_inventory(store_num, cur_top.get());
    } else {
      prt('Entire inventory is shown.', 1, 1);
    }
  } else {
    cur_top.set(1);
    display_inventory(store_num, cur_top.get());
  }
}


async function store_command(store_num: number, com_val: number, cur_top: IRef<number>): Promise<boolean> {
  let exit_flag: boolean = false;

  switch (com_val) {
    case 18:
      display_store(store_num, cur_top.get());
      break;
    case 98:
      browse(store_num, cur_top);
      break;
    case 101:
    case 105:
    case 116:
    case 119:
    case 120:
      await pack_command(store_num, cur_top.get(), String.fromCharCode(com_val));
      break;
    case 112:
      exit_flag = await store_purchase(store_num, cur_top);
      break;
    case 115:
      exit_flag = await store_sell(store_num, cur_top.get());
      break;
    default:
      prt('Invalid Command.', 1, 1);
  }

  return exit_flag;
}


// store2.inc:818 enter_store
export async function enter_store(store_num: number): Promise<void> {
  if (g.store[store_num].store_open < g.turn) {
    const cur_top: IRef<number> = box(1);
    const command: IRef<string> = box('');
    let exit_flag: boolean = false;

    display_store(store_num, cur_top.get());

    do {
      if (await get_com('', command)) {
        g.msg_flag = false;
        exit_flag = await store_command(store_num, command.get().charCodeAt(0), cur_top);
      } else {
        exit_flag = true;
      }
    } while (!exit_flag);

    draw_cave();
  } else {
    await msg_print('The doors are locked.');
  }
}
