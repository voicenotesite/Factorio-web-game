export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function Ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value }
}

export function Err<T = never, E = Error>(error: E): Result<T, E> {
  return { ok: false, error }
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value
  throw result.error
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result
}

export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : Err(fn(result.error))
}

export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? fn(result.value) : result
}

export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  onError?: (err: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await promise
    return Ok(value)
  } catch (err) {
    return Err(onError ? onError(err) : err as E)
  }
}

export function fromTry<T, E = Error>(
  fn: () => T,
  onError?: (err: unknown) => E
): Result<T, E> {
  try {
    return Ok(fn())
  } catch (err) {
    return Err(onError ? onError(err) : err as E)
  }
}
