import { AnyError, NotFoundKeyError } from "./errors";
// import { M } from "./m";
import { Arrow, Arrow2, FlatPromiseOrGenerator, RecDiff } from "./types";

export type UnpackF<T extends F<any, any>> = T extends F<infer U, infer V>
  ? U
  : never;
export type UnpackCtxF<T extends F<any, any>> = T extends F<infer V, infer U>
  ? U
  : {};
export type UnpackProvCtxF<T extends F<any, any>> = T extends F<
  infer V,
  infer D,
  infer U
>
  ? U
  : {};

export class F<I, RC extends {}, R = {}> {
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

  static access = <
    T,
    U = {
      [k in keyof T]: T[k] extends F<any, infer C, infer RC> ? C : never;
    },
    D = {
      [k in keyof T]: T[k] extends F<any, infer C, infer RC> ? RC : never;
    },
    RC = U[keyof U] extends never ? T : T & U[keyof U],
    PC = D[keyof D] extends never ? {} : D[keyof D]
  >() => new F<undefined, RC, PC>(() => undefined);

  static map = <
    A extends F<any, any, any>,
    B,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>,
    PC = UnpackProvCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, B>
  ) => (next: A) => new F<B, RC, PC>(fn, next);

  static tap = <
    A extends F<any, any>,
    B,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>,
    PC = UnpackProvCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, any>
  ) => (next: A) =>
    new F<B, RC, PC>((...args) => {
      fn(...args);
      return args[0];
    }, next);

  static provide = <
    A extends F<any, any>,
    PC extends Partial<RCTX>,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RCTX = UnpackCtxF<A>,
    PPC = UnpackProvCtxF<A>,
    CTX = PC & PPC
  >(
    ctx: PC
  ) => (next: A) => new F<V, RCTX, CTX>((v) => v, next, ctx as any);

  static runPromise = <
    T extends F<any, any, any>,
    U extends T extends F<any, infer RC, infer PC>
      ? NotFoundKeyError extends RecDiff<RC, PC>[keyof RecDiff<RC, PC>]
        ? { [k in keyof RC]: RecDiff<RC, PC>[k] }
        : F<any, RC, PC>
      : never,
    I = NotFoundKeyError extends U[keyof U] ? never : U
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
            (typeof branch![Symbol.iterator] === "function" ||
              typeof branch![Symbol.asyncIterator] === "function");

          if (isGenerator && !Array.isArray(branch)) {
            let i = 0;
            // @ts-ignore
            for await (const newBranch of branches[idx]) {
              if (i++ < branches.length) {
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

  static module = <
    R,
    T extends { clear: () => any; resolve: R },
    A extends F<any, any>,
    B,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>,
    PC = UnpackProvCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, T>
  ) => (next: A) =>
    new M<
      B,
      RC & ReturnType<typeof fn>["resolve"],
      PC & ReturnType<typeof fn>["resolve"],
      ReturnType<typeof fn>["resolve"]
    >(fn, next);
}

export class M<I, RC extends {}, R = {}, IN = {}> extends F<I, RC, R> {
  private clearFn = () => {};
  private resolve!: IN;

  setClear = (clear: () => any) => {
    this.clearFn = clear;
    return this;
  };

  setResolve = (resolve: IN) => {
    this.resolve = resolve;
    return this;
  };

  clear = () => this.clearFn();
}
