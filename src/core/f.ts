import { AnyError, NotFoundKeyError } from "./errors";
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

  private static getRunContext(next: F<unknown, {}>) {
    let inst: Partial<F<unknown, {}>> = { next };
    let ctx = {};
    const stack = [];

    while (inst?.next) {
      inst = inst.next;
      ctx = { ...ctx, ...(inst.ctx ?? {}) };

      stack.push(inst);
    }

    return {
      ctx,
      stack,
    };
  }

  private static runAccept = (
    next: F<any, any>,
    _ctx = {},
    _stack: any = undefined,
    _value = undefined
  ) => {
    const { ctx, stack } = _stack
      ? { stack: _stack, ctx: _ctx }
      : F.getRunContext(next);

    const accept: any = {
      resolve: () => undefined,
      reject: () => undefined,
    };

    const _accept = new Promise((resolve, reject) => {
      accept.resolve = resolve;
      accept.reject = reject;
    });

    const resolve = new Promise(async (res, rej) => {
      await Promise.all(
        Object.entries(ctx).map(async ([k, v]) => {
          if (typeof v === "object" && v instanceof M && !v.isResolved) {
            const res = F.runAccept(v);
            const module: any = await res.accept;

            Object.entries(module.ctx).forEach(([kk, v]) => {
              (ctx as any)[kk] = v;
            });

            (ctx as any)[k] = module.resolve;
          }
        })
      );

      let value = _value;
      for (let i = stack.length - 1; i >= 0; i--) {
        const f = stack[i] as F<any, any>;

        if (f instanceof M) {
          f.accept((ctx, resolve) => {
            accept.resolve({ ctx, resolve: f });
          });
        }

        value = await f.run(value, ctx);

        const isGenerator =
          value &&
          typeof value === "object" &&
          (typeof value![Symbol.iterator] === "function" ||
            typeof value![Symbol.asyncIterator] === "function");

        if (isGenerator) {
          // @ts-ignore
          for await (const v of value) {
            F.runAccept(next, ctx, stack.slice(0, i), v).accept.then(
              accept.resolve
            );
          }

          res(value);
          return;
        }
      }

      res(value);
    });

    return {
      accept: _accept,
      resolve,
    };
  };

  static runPromise = async <
    T extends F<any, any, any>,
    U extends T extends F<any, infer RC, infer PC>
      ? NotFoundKeyError extends RecDiff<RC, PC>[keyof RecDiff<RC, PC>]
        ? { [k in keyof RC]: RecDiff<RC, PC>[k] }
        : F<any, RC, PC>
      : never,
    I = NotFoundKeyError extends U[keyof U] ? never : U
  >(
    ...args: I extends never ? [T, U] : [T]
  ) => {
    return await F.runAccept(args[0]).resolve;
  };

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
  private _resolve!: IN;
  private acceptFn: any;
  private isCalled = false;

  public get isResolved() {
    return this.isCalled;
  }

  public get resolve() {
    return this._resolve;
  }

  private setClear = (clear: () => any) => {
    this.clearFn = clear;
    return this;
  };

  private setResolve = (resolve: IN) => {
    this._resolve = resolve;
    return this;
  };

  clear = () => this.clearFn();

  run = (arg: I, ctx: RC) => {
    if (this.isCalled) {
      return arg;
    }

    const res = this.register(arg, ctx);
    this.setClear(res.clear);
    this.setResolve(res.resolve);
    this.acceptFn(ctx, res.resolve);

    this.isCalled = true;
    return res;
  };

  accept = (cb: (ctx: RC, arg: any) => any) => {
    if (!this.acceptFn) {
      this.acceptFn = cb;
    }
  };
}
