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
  F.map(async function* (_, ctx) {
    let i = 0;
    while (true) {
      await delay(500);
      yield `str ${i++} ${Math.random()}`;

      // if (i >= 2) {
      return;
      // }
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
    for (const workerId of [1]) {
      yield `queue: ${ctx.ds.resolve.queueName} / workerId: ${workerId}`;
    }
  }),
  F.map(async function* (prefix, ctx) {
    for await (const ds of ctx.queue) {
      yield `${prefix} / value: ${ds}`;
    }
  }),
  F.tap((v) => console.log("result:", v)),
  F.provide({ ds }),
  F.runPromise,
  (v) => {
    v.then((v) => console.log("end", v));
  }
);

/*
                        1897
              6609[e]         4943   9299    6638
6454 7254 9061 411 7998     9061      3706    6942
*/

/*
ret 1897 6609 6454 undefined   ended
ret 1897 6609 7254 undefined   ended
result: queue: queueName
ret 1897 4943 9061 queue: queueName
ret 1897 6609 411 undefined     ended
result: queue: queueName
ret 1897 9299 3706 queue: queueName
ret 1897 6609 7998 undefined    ended
ret 1897 6609 undefined
result: queue: queueName
ret 1897 6638 6942 queue: queueName
*/

/*
ret 180 5693 9502 undefined
ret 180 5693 undefined

      180
  5693
9502
*/

/*
start 9808
  start 9808 1191
    value 9808 1191
    value 9808 1191
    isGenerator 9808 1191
    for await start 9808 1191
    for ster 9808 1191 str 0 0.9506798512147052
    start 9808 1191 9179
      make promise 9808 1191 1
      for await end 9808 1191
      wait genPromise 9808 1191 Promise { <pending> }
      value 9808 1191 9179
      value 9808 1191 9179
      ret 9808 1191 9179 undefined
      ?????
    end 9808 1191 9179
    rrr 9808 1191 undefined
    ret 9808 1191 undefined
  end 9808 1191
  value 9808
  value 9808
  isGenerator 9808
  for await start 9808
  for ster 9808 queue: queueName 1 / workerId: 1
  start 9808 374
    make promise 9808 1 function (_) { return _; }
    for await end 9808
    wait genPromise 9808 Promise { <pending> }
    value 9808 374
    isGenerator 9808 374
    for await start 9808 374
    ?????
  ?????
*/
