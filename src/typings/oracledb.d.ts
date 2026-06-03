declare module 'oracledb' {
  const OUT_FORMAT_OBJECT: number;
  let outFormat: number;

  interface Metadata {
    name: string;
  }

  interface Result<T = Record<string, unknown>> {
    rows?: T[];
    metaData?: Metadata[];
    rowsAffected?: number;
  }

  interface ConnectionConfig {
    user: string;
    password: string;
    connectString: string;
  }

  interface ExecuteOptions {
    outFormat?: number;
  }

  interface Connection {
    execute<T = Record<string, unknown>>(
      sql: string,
      bindParams?: Record<string, unknown> | unknown[],
      options?: ExecuteOptions,
    ): Promise<Result<T>>;
    close(): Promise<void>;
  }

  function getConnection(config: ConnectionConfig): Promise<Connection>;
}
