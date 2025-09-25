const DEFAULT_TYPE = "Unknown error";
const DEFAULT_MESSAGE = "Internal error";
const DEFAULT_RETRRYABLE = true;

export class DataPointError extends Error {
  type: string;
  msg: string;
  retryable: boolean;
  orinial?: Error;

  constructor(
    type: string,
    message: string,
    retryable: boolean,
    originalError?: Error,
  ) {
    super(
      `DataPointError (type: ${type}, message: ${message}, retryable: ${retryable}${originalError ? `, original: ${originalError.message}` : ""
      })`,
    );
    this.type = type;
    this.msg = message;
    this.retryable = retryable;
    this.orinial = originalError;
  }

  static defaultFromError(error: Error) {
    return new DataPointError(
      DEFAULT_TYPE,
      DEFAULT_MESSAGE,
      DEFAULT_RETRRYABLE,
      error,
    );
  }
}
