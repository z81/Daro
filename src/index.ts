import { F } from "./core/f";
import { pipe } from "./core/pipe";
import { Queue } from "./core/queue";

/*
проброс контекста [x]
генераторы [x]
паралельное выполнение / таймаут
обработка ошибок
модули
*/

const q = new Queue<string>();
setInterval(() => {
  q.add(`str ${Math.random()}`);
}, 100);

// setTimeout(() => {
//   q.reset();
// }, 5000);

// (async () => {
//   for await (const v of q) {
//     console.log("111111", v);
//   }
//   console.log("111111 end");
// })();
// (async () => {
//   for await (const v of q) {
//     console.log("2222", v);
//   }
//   console.log("2222 end");
// })();
// (async () => {
//   for await (const v of q) {
//     console.log("333333", v);
//   }
//   console.log("333333 end");
// })();

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
    resolve: { username: "test" },
    clear: () => ctx.queue.clear(),
  }))
);

pipe(
  // F.of(() => 1),
  F.access<{
    mul: number;
    prefix: string;
    // ds: typeof ds;
  }>(),
  // F.map((v, ctx) => 1),
  // F.map((v, ctx) => `${2 + v}`),
  // F.map((v, ctx) => `${ctx.prefix}${Number(v) * ctx.mul}`),
  // F.delay(1000),
  // F.map((v) => Promise.resolve(v + 2)),
  F.map(function* (v, ctx) {
    yield 1;
    yield 2;
  }),
  // F.map(async function* (v, ctx) {
  //   for await (const ds of q) {
  //     yield ds;
  //   }
  // }),
  // F.map((v: any) => Promise.resolve(v * 2)),
  F.tap((v, ctx) => console.log("result", v)),
  F.provide({ mul: 100, prefix: "str: " }),
  // F.provide({ ds /*, queue: new Queue<string>()*/ }),
  // F.catch((e) => {
  //   //
  // }),
  F.runPromise
  // f(function* (v: any) {
  //   yield v + 3;
  //   return v + 4;
  // }),
);
