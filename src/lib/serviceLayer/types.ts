/**
 * Shared service layer types.
 * Purely additive — used by read-only service wrappers.
 */

export interface ServiceResult<T> {
  ok: boolean;
  data: T;
  error?: string;
}
