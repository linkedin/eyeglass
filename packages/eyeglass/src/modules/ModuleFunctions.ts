import syncFn from "../util/sync";
import * as debug from "../util/debug";
import merge = require("lodash.merge");
import { SassImplementation } from "../util/SassImplementation";
import type { FunctionDeclarations, SassFunction } from "node-sass";
import { IEyeglass } from "../IEyeglass";
import { Dict, UnsafeDict } from "../util/typescriptUtils";
import heimdall = require("heimdalljs");

const TIME_FN_CALLS = !!(process.env.EYEGLASS_PERF_DEBUGGING);
const ARGUMENTS_REGEX = /\s*\(.*\)$/;
const DELIM = "\n\t\u2022 ";

function getFunctionName(fnSignature: string): string {
  return fnSignature.replace(ARGUMENTS_REGEX, "");
}

function checkConflicts(obj1: FunctionDeclarations, obj2: FunctionDeclarations): void {
  // return early if either collection is empty
  if (!obj1 || !obj2) {
    return;
  }

  let functions: Dict<string> = {};
  // collect all the function names and signatures from the first collection
  Object.keys(obj1).forEach(function(fn) {
    let fnName = getFunctionName(fn);
    functions[fnName] = fn;
  });

  // check all the function names and signatures from the second collection
  Object.keys(obj2).forEach(function(fn) {
    let fnName = getFunctionName(fn);
    let currentFunction = functions[fnName];
    // if the current signature does not match the new signature...
    if (currentFunction && currentFunction !== fn) {
      // throw a warning

      // eslint-disable-next-line no-console
      console.warn("WARNING: Function " + fnName +
        " was redeclared with conflicting function signatures: " +
        currentFunction + " vs. " + fn);
    }
  });
}

export default function ModuleFunctions(eyeglass: IEyeglass, _sass: SassImplementation, _options: unknown, existingFunctions: FunctionDeclarations): FunctionDeclarations {
  let functions: FunctionDeclarations = eyeglass.modules.list.reduce(function(fns, mod) {
    if (!mod.functions) {
      return fns;
    }

    // log any functions found in this module
    /* istanbul ignore next - don't test debug */
    debug.functions && debug.functions(
      "functions discovered in module %s:%s%s",
      mod.name,
      DELIM,
      Object.keys(mod.functions).join(DELIM)
    );
    checkConflicts(fns, mod.functions);
    return merge(fns, mod.functions);
  }, {});

  checkConflicts(functions, existingFunctions);
  functions = merge(functions, existingFunctions);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  functions = syncFn.all(functions as Dict<any>) as UnsafeDict<SassFunction>;

  // log all the functions we discovered
  /* istanbul ignore next - don't test debug */
  debug.functions && debug.functions(
    "all discovered functions:%s%s",
    DELIM,
    Object.keys(functions).join(DELIM)
  );
  return instrumentFunctionCalls(functions);
}

class SassFnSchema {
  [k: string]: {
    count: number;
    time: number;
  };
}

/**
 * nanosecond precision timers.
 */
function timeNS(): [number, number] {
  return process.hrtime();
}

/**
 * nanosecond precision timer difference.
 */
function timeSinceNS(time: [number, number]): number {
  let result = process.hrtime(time);
  return result[0] * 1e9 + result[1];
}

/**
 * This function conditionally instruments all function calls
 * with a heimdall monitor.
 */
function instrumentFunctionCalls(functions: Record<string, SassFunction>): Record<string, SassFunction> {
  if (!TIME_FN_CALLS) return functions;
  if (!heimdall.hasMonitor('sassFns')) {
    heimdall.registerMonitor('sassFns', SassFnSchema)
  }
  for (let fn of Object.keys(functions)) {
    let realFn = functions[fn] as any;
    functions[fn] = function(this: any, ...args: Array<any>) {
      let stats = heimdall.statsFor<SassFnSchema>("sassFns");
      let startTime = timeNS();
      if (!stats[fn]) {
        stats[fn] = {count: 0, time: 0};
      }
      stats[fn].count++;
      if (args.length > 0 && typeof args[args.length - 1] === "function") {
        let realDone = args[args.length - 1];
        args[args.length - 1] = (r: any) => {
          stats[fn].time += timeSinceNS(startTime);
          realDone(r);
        }
      }
      let result = realFn.call(this, ...args);
      if (result) {
        stats[fn].time += timeSinceNS(startTime);
      }
      return result;
    }
  }
  return functions;
}