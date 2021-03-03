import { F } from "./core/f";
import { pipe } from "./core/pipe";

/*
проброс контекста [x]
генераторы [x]
паралельное выполнение / таймаут
обработка ошибок
модули
*/

class Queue<T> {
  private queue: T[] = [];

  add = (value: T) => {
    this.queue.push(value);
  };

  clear = () => {
    this.queue = [];
  };
}

const ds = pipe(
  F.access<{ queue: Queue<string> }>(),
  F.map(function* (v, ctx) {
    yield "Hi!";
    yield "Username%%";
    yield "Bye";
  }),
  F.map((msg, ctx) => ctx.queue.add(msg)),
  F.provide({ queue: new Queue<string>() }),
  F.module((_, ctx) => ({
    resolve: { messagesQueue: ctx.queue },
    clear: () => ctx.queue.clear(),
  }))
);

pipe(
  // F.of(() => 1),
  F.access<{
    mul: number;
    prefix: string;
    ds: typeof ds;
  }>(),
  F.map((v, ctx) => 1),
  F.map((v, ctx) => `${2 + v}`),
  F.map((v, ctx) => `${ctx.prefix}${Number(v) * ctx.mul}`),
  F.delay(1000),
  F.map((v) => Promise.resolve(v + 2)),
  F.map(function* (v, ctx) {
    yield 1;
    yield 2;
    yield 3;
  }),
  F.map((v) => Promise.resolve(v * 2)),
  F.tap((v, ctx) => console.log("result", v)),
  F.provide({ mul: 100, prefix: "str: " }),
  F.provide({ ds /*, queue: new Queue<string>()*/ }),
  // F.catch((e) => {
  //   //
  // }),
  F.runPromise
  // f(function* (v: any) {
  //   yield v + 3;
  //   return v + 4;
  // }),
);
