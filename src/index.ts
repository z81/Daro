import { F } from "./core/f";
import { pipe } from "./core/pipe";

/*
проброс контекста [x]
генераторы [x]
паралельное выполнение / таймаут
обработка ошибок
модули
*/

pipe(
  F.access<{ discord: Map<string, string> }>(),
  F.map((_, ctx) => ctx.discord.set("test", "1")),
  F.map(function* (v, ctx) {
    yield 1;
    yield 2;
    yield 3;
  }),
  F.provide({ discord: new Map<string, string>() })
  // F.module((_, ctx) => ({
  //   discord: ctx.discord,
  // }))
);

pipe(
  // F.of(() => 1),
  F.access<{ mul: number; prefix: string }>(),
  F.map((v, ctx) => 1),
  F.map((v, ctx) => `${2 + v}`),
  F.map((v, ctx) => `${ctx.prefix}${Number(v) * ctx.mul}`),
  F.delay(100),
  F.map((v) => Promise.resolve(v + 2)),
  F.map(function* (v, ctx) {
    yield 1;
    yield 2;
    yield 3;
  }),
  F.map((v) => Promise.resolve(v * 2)),
  F.tap((v, ctx) => console.log("result", v)),
  F.provide({ mul: 100 }),
  F.provide({ prefix: "str: " }),
  // F.catch((e) => {
  //   //
  // }),
  F.runPromise
  // f(function* (v: any) {
  //   yield v + 3;
  //   return v + 4;
  // }),
);
