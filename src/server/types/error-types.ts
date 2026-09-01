export type ApiErrorDetail = {
  message: string;
  field?: string;
};
export type ApiErrorResponse = {
  statusCode: number;
  message: string;
  errors: ApiErrorDetail[];
  success: boolean;
  data: null;
};

export type ApiResponseType<T> = {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
};

export function toAppError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error)
  );
}