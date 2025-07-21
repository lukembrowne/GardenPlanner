declare module 'react-native-papaparse' {
  interface ParseResult<T> {
    data: T[];
    errors: Array<{
      type: string;
      code: string;
      message: string;
      row: number;
    }>;
    meta: {
      delimiter: string;
      linebreak: string;
      aborted: boolean;
      truncated: boolean;
      cursor: number;
    };
  }

  interface ParseConfig<T> {
    complete?: (results: ParseResult<T>) => void;
    error?: (error: Error) => void;
    download?: boolean;
    header?: boolean;
    skipEmptyLines?: boolean;
    dynamicTyping?: boolean;
    transformHeader?: (header: string) => string;
    transform?: (value: string) => any;
  }

  function parse<T = string[]>(input: string, config?: ParseConfig<T>): ParseResult<T>;

  export default {
    parse,
  };
} 