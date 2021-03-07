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

export const enableTrace = Symbol.for("EnableTrace");

export class F<I, RC extends {}, R = {}> {
  readonly _tag = "F";
  name = "";

  constructor(
    readonly register: Arrow2<any, any, any>,
    readonly next?: F<any, any>,
    readonly ctx?: R,
    name = ""
  ) {
    this.name = register.name || name;
  }

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

  static of = <R>(fn: () => R) => new F<R, any>(fn, undefined, undefined, "of");

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
  >() =>
    new F<undefined, RC, PC>(() => undefined, undefined, undefined, "access");

  static map = <
    A extends F<any, any, any>,
    B,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>,
    PC = UnpackProvCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, B>
  ) => (next: A) => new F<B, RC, PC>(fn, next, undefined, "map");

  static tap = <
    A extends F<any, any>,
    B,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RC = UnpackCtxF<A>,
    PC = UnpackProvCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, any>
  ) => (next: A) =>
    new F<B, RC, PC>(
      (...args) => {
        fn(...args);
        return args[0];
      },
      next,
      undefined,
      "tap"
    );

  static provide = <
    A extends F<any, any>,
    PC extends Partial<RCTX>,
    V = FlatPromiseOrGenerator<UnpackF<A>>,
    RCTX = UnpackCtxF<A>,
    PPC = UnpackProvCtxF<A>,
    CTX = PC & PPC
  >(
    ctx: PC
  ) => (next: A) => new F<V, RCTX, CTX>((_) => _, next, ctx as any, "provide");

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
    return `${prefix ? `${prefix} / ` : ""}${nanoid(4).toUpperCase()}`;
  }

  private static runAccept = (
    next: F<any, any>,
    _ctx: Record<string, any> = {},
    _stack: any = undefined,
    _value = undefined,
    level = F.getDebugName(),
    trace: string[] = [],
    isRoot = false
  ) => {
    const runCtx = F.getRunContext(next);
    const ctx: any = Object.assign(runCtx.ctx, _ctx);
    const stack: any = _stack ?? runCtx?.stack;

    const acceptResolvers = {
      resolve: (value: unknown): void => undefined,
      reject: (error: unknown): void => undefined,
    };

    const _accept = new Promise((resolve, reject) => {
      acceptResolvers.resolve = resolve;
      acceptResolvers.reject = reject;
    });

    const isTraceEnabled = F.useTrace in ctx;

    const resolve = new Promise(async (mainResolve, mainReject) => {
      await Promise.all(
        Object.entries(ctx).map(async ([name, dependency]) => {
          if (
            typeof dependency === "object" &&
            dependency instanceof M &&
            !dependency.isResolved
          ) {
            let moduleId = "";
            if (isTraceEnabled) {
              // trace
              moduleId = F.getDebugName(level);
              trace.push(" ".repeat(40) + `Run module "${name}" (${moduleId})`);
            }

            const branchResult = F.runAccept(
              dependency,
              isTraceEnabled ? { [F.useTrace]: true } : undefined,
              undefined,
              undefined,
              moduleId,
              trace
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

            if (isTraceEnabled) {
              branchResult.resolve.then((d) => {
                trace.push(" ".repeat(40) + `End module "${name}"`);
              });
            }
          }
        })
      );

      let generatorPromise: Promise<any> | undefined;
      let value = _value;

      for (let i = stack.length - 1; i >= 0; i--) {
        const f = stack[i] as F<any, any>;

        if (isTraceEnabled) {
          trace.push(
            `[${Date.now()}]   ${level} `.padEnd(50, " ") +
              `${f.name.padEnd(30, " ")}   ${value}`
          );
        }

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
              const genResult = F.runAccept(
                next,
                ctx,
                nextStack,
                v,
                isTraceEnabled ? F.getDebugName(level) : "",
                trace
              );
              genResult.accept.then(acceptResolvers.resolve);

              generatorPromise = genResult.resolve;
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
            if (isTraceEnabled) {
              trace.push(`Module ${module.name} run clear`);
            }
            module.clear();
          });
        }
      }

      mainResolve(value);

      if (isRoot && isTraceEnabled) {
        F.printDebugTable(trace);
      }
    });

    return {
      accept: _accept,
      resolve,
    };
  };

  private static printDebugTable(trace: string[]) {
    let head =
      `      time        id`.padEnd(50, " ") +
      "name" +
      " ".repeat(29) +
      "argument";
    const maxLength = trace.reduce(
      (len, str) => Math.max(len, str.length),
      head.length
    );

    head = head + " ".repeat(maxLength - head.length);
    const line = "─".repeat(maxLength);

    trace.unshift(line, head, line);
    trace.push(line);

    trace = trace.map((str, i) => {
      str = str.padEnd(maxLength, " ");

      switch (i) {
        case 0:
          return `┌${str}┐`;
        case trace.length - 1:
          return `└${str}┘`;
        default:
          return `│${str}│`;
      }
    });

    console.log(trace.join("\n"));
  }

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
    const trace: string[] = [];

    const result = await F.runAccept(
      args[0],
      undefined,
      undefined,
      undefined,
      undefined,
      trace,
      true
    ).resolve;

    return result;
  };

  static empty() {
    return new F(() => undefined, undefined, undefined, "empty");
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
    >(fn, next, undefined, "module");

  static useTrace = Symbol.for("useTrace");
}

// Todo: fix cycle deps
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
