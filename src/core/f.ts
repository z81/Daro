import { nanoid } from "nanoid";
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
  ) => (next: A) => new F<V, RCTX, CTX>((_) => _, next, ctx as any);

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

  private static getDebugName(prefix = "") {
    // Todo: is debug
    return `${prefix}${nanoid(4)}`;
  }

  private static runAccept = (
    next: F<any, any>,
    _ctx: Record<string, any> = {},
    _stack: any = undefined,
    _value = undefined,
    level = F.getDebugName()
  ) => {
    const { ctx, stack } = _stack
      ? { stack: _stack, ctx: _ctx }
      : F.getRunContext(next);

    const acceptResolvers = {
      resolve: (value: unknown): void => undefined,
      reject: (error: unknown): void => undefined,
    };

    const _accept = new Promise((resolve, reject) => {
      acceptResolvers.resolve = resolve;
      acceptResolvers.reject = reject;
    });

    const resolve = new Promise(async (mainResolve, mainReject) => {
      await Promise.all(
        Object.entries(ctx).map(async ([name, dependency]) => {
          if (
            typeof dependency === "object" &&
            dependency instanceof M &&
            !dependency.isResolved
          ) {
            const branchResult = F.runAccept(
              dependency,
              undefined,
              undefined,
              undefined,
              F.getDebugName(level)
            );

            const module = (await branchResult.accept) as {
              ctx: Record<string, any>;
              resolve: Record<string, any>;
            };

            // Merge ctx
            Object.entries(module.ctx).forEach(([kk, v]) => {
              ctx[kk] = ctx[kk] || v;
            });

            ctx[name] = module.resolve;
          }
        })
      );

      let generatorPromise: Promise<any> | undefined;
      let value = _value;

      for (let i = stack.length - 1; i >= 0; i--) {
        const f = stack[i] as F<any, any>;

        if (f instanceof M) {
          f.accept((ctx) => {
            // Resolve deps
            acceptResolvers.resolve({ ctx, resolve: f });
          });

          await f.run(value, ctx);
        } else {
          value = await f.run(value, ctx);

          const isGenerator =
            value &&
            typeof value === "object" &&
            (typeof value![Symbol.iterator] === "function" ||
              typeof value![Symbol.asyncIterator] === "function");

          if (isGenerator) {
            const nextStack = stack.slice(0, i);
            // @ts-ignore
            for await (const v of value) {
              const rr = F.runAccept(
                next,
                ctx,
                nextStack,
                v,
                F.getDebugName(level)
              );
              rr.accept.then(acceptResolvers.resolve);

              generatorPromise = rr.resolve;
            }

            i = 0;
          }
        }
      }

      if (generatorPromise) {
        value = await generatorPromise;

        const module = stack.find((m: any) => m instanceof M);
        if (module) {
          setTimeout(() => {
            module.clear();
          });
        }
      }

      mainResolve(value);
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
    const [v] = (await F.runAccept(args[0]).resolve) as any;
    return v;
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
