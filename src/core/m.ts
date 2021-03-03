import { F } from "./f";

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
