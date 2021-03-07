import { F, enableTrace } from "./core/f";
import { delay } from "./core/fn";
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

const ds = pipe(
  F.access<{ queue: Queue<string> }>(),
  F.map(async function* generateRandString(_, ctx) {
    let i = 0;
    while (true) {
      await delay(500);
      yield `str ${i++} ${Math.random()}`;

      //if (i >= 5) {
      return;
      //}
    }
  }),
  F.map(function queueAdd(msg, ctx) {
    return ctx.queue.add(msg);
  }),
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
  F.map(function* makeQueueName(_, ctx) {
    for (const workerId of [1]) {
      yield `queue: ${ctx.ds.resolve.queueName} / workerId: ${workerId}`;
    }
  }),
  F.map(async function* getQueueValue(prefix, ctx) {
    for await (const ds of ctx.queue) {
      yield `${prefix} / value: ${ds}`;
    }
  }),
  F.tap((v) => console.log("result:", v)),
  F.provide({
    ds,
    [F.useTrace]: true,
  }),
  F.runPromise,
  (v) => {
    v.then((v) => console.log("end", v));
  }
);
