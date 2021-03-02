/*import * as T from "@effect-ts/core/Effect";
import * as S from "@effect-ts/system/Stream";
import * as O from "@effect-ts/system/Option";
import * as SK from "@effect-ts/system/Stream/Sink";
import { pipe } from "fp-ts/lib/function";

console.log("test");

const sink = SK.collectAllToMap((k: number) => {
  console.log("abc", k);

  return `key-${k}`;
})(() => 1);

const result = pipe(
  S.effectAsync<unknown, never, number>((cb) => {
    let counter = 0;

    setInterval(() => {
      cb(T.succeed([counter++]));
    }, 10);
  }),
  S.run(sink),
  T.runAsap
);
*/
// import * as Array from "@effect-ts/core/Array";
// // import * as Map from "@effect-ts/core/Map";
// import * as T from "@effect-ts/core/Effect";
// import * as L from "@effect-ts/core/Effect/Layer";
// import * as M from "@effect-ts/core/Effect/Managed";
// import * as Ref from "@effect-ts/core/Effect/Ref";
// import * as Q from "@effect-ts/system/Queue";
// import * as S from "@effect-ts/system/Stream";
// import * as O from "@effect-ts/system/Option";
import { pipe } from "@effect-ts/core/Function";
// import type { NoSuchElementException } from "@effect-ts/system/GlobalExceptions";
// import { tag } from "@effect-ts/system/Has";
// import { Any } from "@effect-ts/core/Prelude";
// import { number } from "io-ts";

// simulate a database connection to a key-value store
// export interface DbConnection {
//   readonly start: () => T.UIO<void>;
//   readonly clear: T.UIO<void>;
//   readonly sub: T.Effect<unknown, never, unknown>;
// }

// export const DbConnection = tag<DbConnection>();

// export const DbLive = pipe(
//   Q.makeUnbounded<number>(),
//   T.chain((ref) =>
//     T.effectTotal(
//       (): DbConnection => ({
//         start: () =>
//           T.effectTotal(() => {
//             let i = 0;
//             setInterval(() => {
//               ref.offer(i++);
//             }, 10);
//           }),
//         sub: ref.take,
//         clear: T.effectTotal(() => {
//           console.log("clear");
//         }),
//       })
//     )
//   ),
//   M.make((_) => _.clear),
//   L.fromManaged(DbConnection)
// );

// export const ProgramLive = L.all(DbLive);

// export const { start, sub } = T.deriveLifted(DbConnection)(
//   ["start"],
//   ["sub"],
//   []
// );

// // write a program that use the database
// export const program = pipe(
//   T.do,
//   T.tap(() => start()),
//   T.chain(() => sub),
//   T.map((v) => {
//     console.log(v);
//   })
// );

// // run the program and print the output
// pipe(
//   program,
//   T.chain((s) =>
//     T.effectTotal(() => {
//       console.log(`Done: ${s}`);
//     })
//   ),
//   T.provideSomeLayer(ProgramLive),
//   T.run
// );

// const q = Q.makeUnbounded<number>();

// const result = pipe(
//   S.effectAsync<unknown, never, number>((cb) => {
//     let counter = 0;

//     setInterval(() => {
//       cb(T.succeed([counter++]));
//     }, 300);
//   })
//   // S.toQueueUnbounded
// );

// pipe(
//   // T.effectTotal(() => {
//   //   console.log("Start");
//   // }),
//   // T.chain(() => result),
//   result,
//   S.tap((v) =>
//     T.effectTotal(() => {
//       console.log(v);
//     })
//   ),
//   S.runCount,
//   T.chain((v) => {
//     console.log("chain");
//     return T.effectTotal(() => {
//       console.log("chain", v);
//       return v;
//     });
//   }),
//   // T.chain(() => {
//   //   return T.effectAsync<unknown, unknown, number>((cb) =>
//   //     setTimeout(() => {
//   //       cb(T.effectTotal(() => 1));
//   //     }, 1000)
//   //   );
//   // }),
//   // T.chain(() => {
//   //   return T.effectAsync<unknown, unknown, number>((cb) =>
//   //     setTimeout(() => {
//   //       cb(T.effectTotal(() => 2));
//   //     }, 500)
//   //   );
//   // }),
//   // T.effectTotal(() => 1),
//   T.tap((v) => {
//     return T.effectTotal(() => {
//       console.log(v);
//     });
//   }),
//   T.run
// );

// import * as Ex from "@effect-ts/core/Effect/Exit";
// import type { Has } from "@effect-ts/core/Has";
// import { intersect } from "@effect-ts/core/Utils";
// import * as http from "http";

// export interface HTTPServerConfig {
//   config: {
//     host: string;
//     port: number;
//   };
// }

// export const HTTPServerConfig = tag<HTTPServerConfig>();

// export const { config: accessServerConfigM } = T.deriveAccessM(
//   HTTPServerConfig
// )(["config"]);

// export function serverConfig(
//   config: HTTPServerConfig["config"]
// ): L.Layer<unknown, never, Has<HTTPServerConfig>> {
//   return L.create(HTTPServerConfig).pure({ config });
// }

// export interface Request {
//   req: http.IncomingMessage;
//   res: http.ServerResponse;
// }

// export const Request = tag<Request>();

// export const { req: accessReqM, res: accessResM } = T.deriveAccessM(Request)([
//   "req",
//   "res",
// ]);

// export interface Server {
//   server: http.Server;
// }

// export interface RequestQueue {
//   queue: Q.Queue<Request>;
// }

// export const Server = tag<Server>();
// export const RequestQueue = tag<RequestQueue>();

// export const { queue: accessQueueM } = T.deriveAccessM(RequestQueue)(["queue"]);
// export const { server: accessServerM } = T.deriveAccessM(Server)(["server"]);

// export const LiveHTTP = pipe(
//   Q.makeUnbounded<Request>(),
//   T.chain((queue) =>
//     pipe(
//       T.effectTotal(() =>
//         http.createServer((req, res) => {
//           console.log(req, req);
//           T.run(queue.offer({ req, res }));
//         })
//       ),
//       T.map((server): Server & RequestQueue => ({ server, queue }))
//     )
//   ),
//   T.tap(({ server }) =>
//     accessServerConfigM(({ host, port }) =>
//       T.effectAsync<unknown, never, void>((cb) => {
//         function clean() {
//           console.log("clean");
//           server.removeListener("error", onErr);
//           server.removeListener("listening", onDone);
//         }
//         function onErr(err: Error) {
//           console.log("err", err);
//           clean();
//           cb(T.die(err));
//         }
//         function onDone() {
//           console.log("onDone");
//           clean();
//           cb(T.unit);
//         }
//         console.log("server", port, host);
//         server.listen(port, host);

//         server.once("error", onErr);
//         server.once("listening", onDone);
//       })
//     )
//   ),
//   M.make(({ queue, server }) =>
//     pipe(
//       T.tuple(
//         T.result(
//           T.effectAsync<unknown, never, void>((cb) => {
//             server.close((err) => {
//               console.log("close", err);
//               if (err) {
//                 cb(T.die(err));
//               } else {
//                 cb(T.unit);
//               }
//             });
//           })
//         ),
//         T.result(queue.shutdown)
//       ),
//       T.chain(([ea, eb]) => T.done(Ex.zip(eb)(ea)))
//     )
//   ),
//   M.map((_) => intersect(Server.of(_), RequestQueue.of(_))),
//   L.fromRawManaged
// );

// export const ServerConfigMain = serverConfig({
//   host: "0.0.0.0",
//   port: 8081,
// });

// function main() {
//   return pipe(
//     accessQueueM((q) => {
//       return pipe(
//         q.take,
//         T.tap((v) => {
//           return T.effectTotal(() => {
//             console.log(v);
//           });
//         })
//       );
//     }),
//     T.provideSomeLayer(LiveHTTP["<<<"](ServerConfigMain)),
//     T.run
//   );
// }

/*
проброс контекста [x]
паралельное выполнение / таймаут
обработка ошибок
модули
*/

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

type Inline<T> = { [k in keyof T]: T[k] };

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

  static delay = <A extends F<any, any>, R = FlatPromise<UnpackF<A>>>(
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
    V = FlatPromise<UnpackF<A>>,
    RC = UnpackCtxF<A>
  >(
    fn: Arrow2<V, UnpackCtxF<A>, B>
  ) => (next: A) => new F<B, RC>(fn, next);

  static tap = <
    A extends F<any, any>,
    B,
    V = FlatPromise<UnpackF<A>>,
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
    V = FlatPromise<UnpackF<A>>,
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
    new Promise<U>((resolve) => {
      let inst: any = { next: args[0] };
      let ctx = {};
      const stacks = [];

      while (inst?.next) {
        inst = inst.next;
        ctx = { ...ctx, ...(inst.ctx ?? {}) };
        stacks.push(inst as any);
      }

      resolve(
        stacks.reduceRight((res: unknown, inst) => {
          if (res instanceof Promise) {
            return res.then((res) => inst.run(res, ctx));
          }

          return inst.run(res, ctx);
        }, undefined)
      );
    });

  static get empty() {
    return new F(() => undefined);
  }
}

type Head<Ts extends [any, ...any[]]> = Ts extends [infer T, ...any[]]
  ? T
  : never;

// const pipe2 = <T>(...args: T) => {
//   //
// };
pipe(
  F.access<{ discord: Map<string, string> }>(),
  F.map((_, ctx) => ctx.discord.set("test", "1")),
  F.provide({ discord: new Map<string, string>() }),
  F.module((_, ctx) => ({
    discord: ctx.discord,
  }))
);
// pipe2(
//   1,
//   (v) => v + 1,
//   (v) => v + 1,
//   console.log
// );

pipe(
  // F.of(() => 1),
  F.access<{ mul: number; prefix: string }>(),
  F.map((v, ctx) => 1),
  F.map((v, ctx) => `${2 + v}`),
  F.map((v, ctx) => `${ctx.prefix}${Number(v) * ctx.mul}`),
  F.delay(100),
  F.map((v) => Promise.resolve(v + 2)),
  F.tap((v) => console.log(v)),
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
