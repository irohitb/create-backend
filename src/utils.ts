export type Dict<T> = {
  [key in string]?: T;
};

export type JustId<T> = {
  id: T;
};
