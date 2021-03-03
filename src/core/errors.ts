export type IncorrectTypeError<T, T2> = AnyError & {
  type1: T;
  type2: T2;
};

export type NotFoundKeyError = AnyError & {
  _sub: "notFoundKey";
};

export type AnyError = {
  _tag: "Error";
};
