export type Result<S, E> =
  | { type: "SUCCESS"; data: S }
  | { type: "FAILURE"; error: E };

export const success = <S, E>(data: S): Result<S, E> => {
  return { type: "SUCCESS", data: data };
};

export const fail = <S, E>(error: E): Result<S, E> => {
  return { type: "FAILURE", error: error };
};
