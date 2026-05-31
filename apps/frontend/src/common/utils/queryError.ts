;export type HttpStatusCode = number;
type HttpStatusText = string;
type Method = 'GET' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH';
type Url = string;

interface BaseQueryError extends Error {
  isQueryError: true;
  originalError?: Error | undefined;
  toJSON(): object;
  url: Url;
  method: Method;
}

export interface QueryNetworkError extends BaseQueryError {
  type: 'NetworkError';
}

export interface QueryRequestError<T> extends BaseQueryError {
  type: 'RequestError';
  status: HttpStatusCode;
  statusText: HttpStatusText;
  data: T;
}

interface QueryServerError extends BaseQueryError {
  type: 'ServerError';
  status: HttpStatusCode;
  statusText: HttpStatusText;
}

export type QueryError<T> =
  | QueryNetworkError
  | QueryRequestError<T>
  | QueryServerError;

type QueryErrorType = 'NetworkError' | 'RequestError' | 'ServerError';
type ErrorConstructorWithCaptureStackTrace = ErrorConstructor & {
  captureStackTrace: (targetObject: object, constructorOpt?: object) => void;
};

const hasCaptureStackTrace = (
  errorConstructor: ErrorConstructor,
): errorConstructor is ErrorConstructorWithCaptureStackTrace => {
  const maybeErrorConstructor = errorConstructor as ErrorConstructor & {
    captureStackTrace?: unknown;
  };

  return typeof maybeErrorConstructor.captureStackTrace === 'function';
};

export const isRequestError = <T>(
  queryError: QueryError<T>,
): queryError is QueryRequestError<T> => queryError.type === 'RequestError';
export const isQueryError = <T>(error: Error): error is QueryError<T> =>
  error instanceof QueryNetworkErrorClass ||
  error instanceof QueryRequestErrorClass ||
  error instanceof QueryServerErrorClass;

export const fromFetchError = async <T>(
  request: Request,
  response: Response | Error,
): Promise<QueryError<T>> => {
  if (
    response instanceof QueryNetworkErrorClass ||
    response instanceof QueryRequestErrorClass ||
    response instanceof QueryServerErrorClass
  ) {
    return response;
  }

  if (response instanceof Error) {
    return new QueryNetworkErrorClass({
      url: request.url,
      method: request.method as Method,
      originalError: response,
    });
  }

  const errorType = getQueryErrorTypeFromStatus(response.status);
  switch (errorType) {
    case 'NetworkError':
      return new QueryNetworkErrorClass({
        url: request.url,
        method: request.method as Method,
      });

    case 'RequestError':
      return new QueryRequestErrorClass({
        status: response.status,
        statusText: response.statusText,
        data: await response.clone().json(),
        url: request.url,
        method: request.method as Method,
      });

    default:
      return new QueryServerErrorClass({
        status: response.status,
        statusText: response.statusText,
        url: request.url,
        method: request.method as Method,
      });
  }
};

// util factory to manually create a query request error
// useful when an API call succeeds but the data returned is not what is expected, and we need to treat it as an error
export const customQueryRequestErrorFactory = <T>({
  status = 400,
  statusText = 'BadRequest',
  ...rest
}: {
  status?: HttpStatusCode;
  statusText?: HttpStatusText;
  data: T;
  url: Url;
  method: Method;
}): QueryRequestError<T> =>
  new QueryRequestErrorClass({
    status,
    statusText,
    ...rest,
  });

const getQueryErrorTypeFromStatus = (
  status: number | undefined,
): QueryErrorType => {
  if (status === 0 || status === undefined) {
    return 'NetworkError';
  }

  if (status >= 400 && status < 499) {
    return 'RequestError';
  }

  return 'ServerError';
};

export class QueryNetworkErrorClass extends Error implements QueryNetworkError {
  isQueryError = true as const;
  type = 'NetworkError' as const;
  originalError?: Error | undefined;
  method: Method;
  url: Url;

  constructor({
    originalError,
    method,
    url,
  }: {
    originalError?: Error;
    method: Method;
    url: Url;
  }) {
    super(`API request failure: Network error, ${method} ${url}`);
    Object.setPrototypeOf(this, QueryNetworkErrorClass.prototype);

    if (hasCaptureStackTrace(Error)) {
      Error.captureStackTrace(this, QueryNetworkErrorClass);
    }
    this.name = this.type;
    this.originalError = originalError;
    this.method = method;
    this.url = url;
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      url: this.url,
      method: this.method,
    };
  }
}

class QueryRequestErrorClass<T> extends Error implements QueryRequestError<T> {
  originalError?: Error | undefined;
  isQueryError = true as const;
  type = 'RequestError' as const;
  status: HttpStatusCode;
  statusText: HttpStatusText;
  data: T;
  method: Method;
  url: Url;

  constructor({
    status,
    statusText,
    data,
    originalError,
    method,
    url,
  }: {
    status: HttpStatusCode;
    statusText: HttpStatusText;
    data: T;
    originalError?: Error;
    method: Method;
    url: Url;
  }) {
    super(
      `API request failure: Bad request error: ${statusText}, ${status} ${method} ${url}`,
    );
    Object.setPrototypeOf(this, QueryRequestErrorClass.prototype);

    if (hasCaptureStackTrace(Error)) {
      Error.captureStackTrace(this, QueryRequestErrorClass);
    }

    this.name = this.type;
    this.originalError = originalError;
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.method = method;
    this.url = url;
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      status: this.status,
      statusText: this.statusText,
      data: this.data,
      url: this.url,
      method: this.method,
    };
  }
}

class QueryServerErrorClass extends Error implements QueryServerError {
  originalError?: Error | undefined;
  isQueryError = true as const;
  type = 'ServerError' as const;
  status: HttpStatusCode;
  statusText: HttpStatusText;
  method: Method;
  url: Url;

  constructor({
    status,
    statusText,
    originalError,
    method,
    url,
  }: {
    status: HttpStatusCode;
    statusText: HttpStatusText;
    originalError?: Error;
    method: Method;
    url: Url;
  }) {
    super(
      `API request failure: Server error, ${statusText}, ${status} ${method} ${url}`,
    );
    Object.setPrototypeOf(this, QueryServerErrorClass.prototype);

    if (hasCaptureStackTrace(Error)) {
      Error.captureStackTrace(this, QueryServerErrorClass);
    }

    this.name = this.type;
    this.originalError = originalError;
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.url = url;
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      status: this.status,
      statusText: this.statusText,
      url: this.url,
      method: this.method,
    };
  }
}
