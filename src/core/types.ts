import { NotFoundKeyError } from "./errors";

export type FlatPromise<T extends Promise<any>> = T extends Promise<infer U>
  ? U extends Promise<any>
    ? FlatPromise<U>
    : U
  : T;

export type FlatPromiseOrGenerator<
  T extends Promise<any> | Generator<any>
> = T extends Promise<infer U> | Generator<infer U>
  ? U extends Promise<any>
    ? FlatPromiseOrGenerator<U>
    : U
  : T;

export type RecDiff<
  A extends Record<string, any>,
  B extends Record<string, any>
> = {
  // @ts-expect-error
  [k in keyof A]: unknown extends B[k]
    ? NotFoundKeyError
    : // @ts-expect-error
    A[k] extends B[k]
    ? A[k]
    : // @ts-expect-error
      IncorrectTypeError<A[k], B[k]>;
};

export type Arrow<A, B> = (a: A) => B;
export type Arrow2<A, B, C> = (a: A, b: B) => C;
export type Arrow3<A, B, C, D> = (a: A, b: B, c: C) => D;
