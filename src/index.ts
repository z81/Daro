/*
проброс контекста [x]
генераторы [x]
паралельное выполнение / таймаут
обработка ошибок
модули
*/

import { pipe } from "./pipe";

type Arrow<A, B> = (a: A) => B;
type Arrow2<A, B, C> = (a: A, b: B) => C;
type Arrow3<A, B, C, D> = (a: A, b: B, c: C) => D;

type UnpackF<T extends F<any, any>> = T extends F<infer U, infer V> ? U : never;
type UnpackCtxF<T extends F<any, any>> = T extends F<infer V, infer U> ? U : {};
type UnpackProvCtxF<T extends F<any, any>> = T extends F<
  infer V,
  infer D,
  infer U
>
  ? U
  : {};

type FlatPromise<T extends Promise<any>> = T extends Promise<infer U>
  ? U extends Promise<any>
    ? FlatPromise<U>
    : U
  : T;

type FlatPromiseOrGenerator<
  T extends Promise<any> | Generator<any>
> = T extends Promise<infer U> | Generator<infer U>
  ? U extends Promise<any>
    ? FlatPromiseOrGenerator<U>
    : U
  : T;

type IncorrectTypeError<T, T2> = {
  _tag: "Error";
  type1: T;
  type2: T2;
};

type NotFoundKeyError = {
  _tag: "Error";
};

type Error = {
  _tag: "Error";
};

type RecDiff<A extends Record<string, any>, B extends Record<string, any>> = {
  // @ts-expect-error
  [k in keyof A]: unknown extends B[k]
    ? NotFoundKeyError
    : // @ts-expect-error
    A[k] extends B[k]
    ? A[k]
    : // @ts-expect-error
      IncorrectTypeError<A[k], B[k]>;
};

class F<I, RC extends {}, R = {}> {
  readonly _tag = "F";

  constructor(
    readonly register: Arrow2<any, any, any>,
    readonly next?: F<any, any>,
    readonly ctx?: R
  ) {}

  run = (arg: I, ctx: RC) => this.register(arg, ctx);

  static delay = <
    A extends F<any, any>,
    R = FlatPromiseOrGenerator<UnpackF<A>>
  >(
    time: number
  ) =>
    F.map<A, R>(
      (v) => new Promise<R>((resolve) => setTimeout(resolve, time, v)) as any
    );

  static of = <R>(fn: () => R) => new F<R, any>(fn);

  static access = <T>() => new F<undefined, T>(() => undefined);

  static map = <
    A extends F<any, any>,
    B,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, B>
  ) => (next: A) => new F<B, RC>(fn, next);

  static tap = <
    A extends F<any, any>,
    B,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, any>
  ) => (next: A) =>
    new F<B, RC>((...args) => {
      fn(...args);
      return args[0];
    }, next);

  static provide = <
    A extends F<any, any>,
    PC extends Partial<RC>,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>,
    PPC = UnpackProvCtxF<A>,
    C = PC & PPC
  >(
    ctx: PC
  ) => (next: A) => new F<V, RC, C>((v) => v, next, ctx as any);

  static runPromise = <
    T extends F<any, any, any>,
    U extends T extends F<any, infer RC, infer PC>
      ? Error extends RecDiff<RC, PC>[keyof RecDiff<RC, PC>]
        ? { [k in keyof RC]: RecDiff<RC, PC>[k] }
        : F<any, RC, PC>
      : never,
    I = Error extends U[keyof U] ? never : U
  >(
    ...args: I extends never ? [T, U] : [T]
  ) =>
    new Promise<U>(async (resolve) => {
      let inst: any = { next: args[0] };
      let ctx = {};
      const stacks = [];

      while (inst?.next) {
        inst = inst.next;
        ctx = { ...ctx, ...(inst.ctx ?? {}) };
        stacks.unshift(inst as any);
      }

      let branches = [undefined];
      for (const inst of stacks) {
        for (const idx in branches) {
          const branch = branches[idx];
          const isGenerator =
            branch &&
            typeof branch === "object" &&
            typeof branch![Symbol.iterator] === "function";

          if (isGenerator && !Array.isArray(branch)) {
            let i = 0;
            // @ts-ignore
            for (const newBranch of branches[idx]) {
              if (i++ === 0) {
                branches[idx] = await inst.run(newBranch, ctx);
              } else {
                branches.push(await inst.run(newBranch, ctx));
              }
            }
          }
        }

        for (const idx in branches) {
          branches[idx] = await inst.run(branches[idx], ctx);
        }
      }

      resolve(branches as any);
    });

  static empty() {
    return new F(() => undefined);
  }
}

pipe(
  F.access<{ discord: Map<string, string> }>(),
  F.map((_, ctx) => ctx.discord.set("test", "1")),
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
