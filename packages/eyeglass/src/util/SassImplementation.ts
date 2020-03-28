import type * as sass from "node-sass";
import { unreachable } from "./assertions";
export type { Options } from "node-sass";

type SassValue = sass.types.Value;
type SassString = sass.types.String;
type SassColor = sass.types.Color;
type SassNumber = sass.types.Number;
type SassBoolean = sass.types.Boolean;
type SassNull = sass.types.Null;
type SassError = sass.types.Error;
type SassMap = sass.types.Map;
type SassList = sass.types.List;

export function isSassValue(
  sass: SassImplementation,
  value: unknown
): value is sass.types.Value {
  if (value && typeof value === "object") {
    return isSassNumber(sass, value)
        || isSassString(sass, value)
        || isSassColor(sass, value)
        || isSassBoolean(sass, value)
        || isSassList(sass, value)
        || isSassMap(sass, value)
        || isSassNull(sass, value);
  } else {
    return false;
  }
}

export function inspect(sass: SassImplementation, value: SassValue): string {
  if (isSassNumber(sass, value)) {
    return `${value.getValue()}${value.getUnit()}`
  } else if (isSassString(sass, value)) {
    return value.getValue();
  } else if (isSassColor(sass, value)) {
    return `rgba(${value.getR()}, ${value.getG()}, ${value.getB()}, ${value.getA()})`
  } else if (isSassBoolean(sass, value)) {
    if (value === sass.types. Boolean.TRUE) {
      return `true`;
    } else {
      return `false`;
    }
  } else if (isSassList(sass, value)) {
    let s = "(";
    for (let i = 0; i < value.getLength(); i++) {
      if (i > 0) {
        if (value.getSeparator()) {
          s += ", ";
        } else {
          s += " ";
        }
      }
      s += inspect(sass, value.getValue(i));
    }
    s += ")";
    return s;
  } else if (isSassMap(sass, value)) {
    let s = "(";
    for (let i = 0; i < value.getLength(); i++) {
      if (i > 0) {
        s += ", ";
      }
      s += value.getKey(i);
      s += ": ";
      s += inspect(sass, value.getValue(i));
    }
    s += ")";
    return s;
  } else if (isSassNull(sass, value)) {
    return "null";
  } else {
    return unreachable();
  }
}

export function isSassNumber(sass: SassImplementation, value: unknown): value is SassNumber {
  return value instanceof sass.types.Number;
}
export function isSassString(sass: SassImplementation, value: unknown): value is SassString {
  return value instanceof sass.types.String;
}
export function isSassColor(sass: SassImplementation, value: unknown): value is SassColor {
  return value instanceof sass.types.Color;
}
export function isSassBoolean(sass: SassImplementation, value: unknown): value is SassBoolean {
  return value instanceof sass.types.Boolean;
}
export function isSassNull(sass: SassImplementation, value: unknown): value is SassNull {
  return value === sass.types.Null.NULL;
}
export function isSassList(sass: SassImplementation, value: unknown): value is SassList {
  return value instanceof sass.types.List;
}
export function isSassMap(sass: SassImplementation, value: unknown): value is SassMap {
  return value instanceof sass.types.Map;
}

export function isSassMapOrEmptyList(sass: SassImplementation, value: unknown): value is SassMap | SassList {
  return isSassMap(sass, value) || (isSassList(sass, value) && value.getLength() === 0);
}

export function isSassError(sass: SassImplementation, value: unknown): value is SassError {
  return value instanceof sass.types.Error;
}

export type SassImplementation = typeof sass;

export function isSassImplementation(impl: unknown): impl is SassImplementation {
  return (
    impl && typeof impl === "object"
    && impl !== null
    && typeof (impl as SassImplementation).render === "function"
    && typeof (impl as SassImplementation).renderSync === "function"
    && typeof (impl as SassImplementation).types === "object"
    && typeof (impl as SassImplementation).info === "string"
  );
}

const typeGuards = {
  null: isSassNull,
  string: isSassString,
  number: isSassNumber,
  map: isSassMapOrEmptyList,
  list: isSassList,
  color: isSassColor,
  boolean: isSassBoolean,
  error: isSassError,
};

interface SassType {
  null: SassNull;
  string: SassString;
  number: SassNumber;
  map: SassMap | SassList;
  list: SassList;
  color: SassColor;
  boolean: SassBoolean;
  error: SassError;
}

type SassTypeName = keyof typeof typeGuards;

function typeName(sass: SassImplementation, value: SassValue | SassError): SassTypeName {
  if (isSassNull(sass, value)) return "null";
  if (isSassString(sass, value)) return "string";
  if (isSassNumber(sass, value)) return "number";
  if (isSassMap(sass, value)) return "map";
  if (isSassList(sass, value)) return "list";
  if (isSassColor(sass, value)) return "color";
  if (isSassBoolean(sass, value)) return "boolean";
  if (isSassError(sass, value)) return "error";
  return unreachable(value);
}

export function isType<Name extends SassTypeName>(
  sass: SassImplementation, value: SassValue | SassError, name: Name
): value is SassType[Name] {
  let guard = typeGuards[name];
  if (guard(sass, value)) {
    return true;
  } else {
    return false;
  }
}

export function typeError(sass: SassImplementation, expected: SassTypeName, actual: SassTypeName | SassValue): SassError {
  return new sass.types.Error(`Expected ${expected}, got ${typeof actual === "string" ? actual : typeName(sass, actual)}${typeof actual === "string" ? "" : `: ${inspect(sass, actual)}`}`);
}

export class SassTypeError extends Error {
  constructor(sass: SassImplementation, expected: SassTypeName, actual: SassTypeName | SassValue) {
    super(`Expected ${expected}, got ${typeof actual === "string" ? actual : typeName(sass, actual)}${typeof actual === "string" ? "" : `: ${inspect(sass, actual)}`}`);
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function helpers(sass: SassImplementation) {
  return {
    isSass:    (value: unknown): value is SassImplementation => isSassImplementation(value),
    isNull:    (value: unknown): value is SassNull    => isSassNull(sass, value),
    isString:  (value: unknown): value is SassString  => isSassString(sass, value),
    isNumber:  (value: unknown): value is SassNumber  => isSassNumber(sass, value),
    isMap:     (value: unknown): value is SassMap     => isSassMap(sass, value),
    isList:    (value: unknown): value is SassList    => isSassList(sass, value),
    isColor:   (value: unknown): value is SassColor   => isSassColor(sass, value),
    isBoolean: (value: unknown): value is SassBoolean => isSassBoolean(sass, value),
    isError:   (value: unknown): value is SassError   => isSassError(sass, value),
    isValue:   (value: unknown): value is SassValue   => isSassValue(sass, value),
    isMapOrEmptyList: (value: unknown): value is SassMap | SassList => isSassMapOrEmptyList(sass, value),
    typeError: typeError.bind(null, sass),
    isType:    isType.bind(null, sass),
    typeName:  typeName.bind(null, sass),
    inspect: inspect.bind(null, sass),
    TypeError: class extends SassTypeError {
      constructor(expected: SassTypeName, actual: SassTypeName | SassValue) {
        super(sass, expected, actual);
      }
    }
  };
}
