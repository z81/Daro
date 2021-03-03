export type IncorrectTypeError<T, T2> = {
  _tag: "Error";
  type1: T;
  type2: T2;
};

export type NotFoundKeyError = {
  _tag: "Error";
};

export type Error = {
  _tag: "Error";
};
