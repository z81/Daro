import { F } from "./core/f";
import { pipe } from "./core/pipe";
import { Queue } from "./core/queue";

const q = new Queue<string>();
setInterval(() => {
  q.add(`outside queue ${Math.random()}`);
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

const delay = (t: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, t);
  });

const ds = pipe(
  F.access<{ queue: Queue<string> }>(),
  F.map(async function* () {
    while (true) {
      await delay(500);
      yield `str ${Math.random()}`;
    }
  }),
  F.map((msg, ctx) => ctx.queue.add(msg)),
  F.provide({ queue: new Queue<string>() }),
  F.module((_, ctx) => ({
    resolve: { queueName: "queueName 1" },
    clear: () => ctx.queue.clear(),
  }))
);

pipe(
  F.access<{
    ds: typeof ds;
  }>(),
  F.map(function* (_, ctx) {
    for (const workerId of [1, 2, 3, 4]) {
      yield `queue: ${ctx.ds.resolve.queueName} / workerId: ${workerId}`;
    }
  }),
  F.map(async function* (prefix, ctx) {
    for await (const ds of ctx.queue) {
      yield `${prefix} / value: ${ds}`;
    }
  }),
  F.tap((v) => console.log("result:", v)),
  F.provide({ ds, queue: q }),
  F.runPromise
);
