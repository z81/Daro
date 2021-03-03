import { Arrow2, FlatPromiseOrGenerator, RecDiff } from "./types";

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
}
