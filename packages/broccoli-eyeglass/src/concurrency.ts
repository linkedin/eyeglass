import debugGenerator = require("debug");
import systeminformation = require("systeminformation");

const concurrencyDebug = debugGenerator("broccoli-eyeglass:concurrency");

export const DEFAULT_CONCURRENCY = Number(process.env.SASS_JOBS) || Number(process.env.JOBS) || 4;

export function determineOptimalConcurrency(): Promise<number> {
  let sassConcurrency = Number(process.env.SASS_JOBS) || Number(process.env.JOBS) || undefined;
  let threadpoolSize = Number(process.env.UV_THREADPOOL_SIZE) || undefined;
  if (sassConcurrency) {
    concurrencyDebug(
      "%d concurrent sass jobs have been requested.",
      sassConcurrency);
  } else {
    concurrencyDebug("Neither SASS_JOBS nor JOBS is set in this environment");
  }
  if (threadpoolSize) {
    concurrencyDebug(
      "UV threadpool size is explicitly set to %d.",
      threadpoolSize);
  } else {
    concurrencyDebug("UV_THREADPOOL_SIZE is not set in this environment");
  }

  // It does no good to have more sass concurrency than the threadpool size.
  if (threadpoolSize && sassConcurrency && threadpoolSize < sassConcurrency) {
    concurrencyDebug(
      "Capping sass concurrency to threadpool size of %d.",
      threadpoolSize);
    sassConcurrency = threadpoolSize;
  }
  // Exit early, the user is in control.
  if (threadpoolSize && sassConcurrency) {
    concurrencyDebug("Using user-specified concurrency values.");
    return Promise.resolve(sassConcurrency);
  }

  // We don't have a threadpool size, we need to set one based on our cores.
  // testing shows that maximum throughput is achieved by using the number
  // of physical cores of the machine.
  return systeminformation.cpu().then((result) => {
    let {cores, physicalCores} = result;
    concurrencyDebug("There are %d physical cores in this machine", physicalCores)
    if (threadpoolSize && threadpoolSize <= cores) {
      // sassConcurrency is undefined if threadpoolSize is defined.
      concurrencyDebug(
        "Using all %d available threads for sass compilation.",
        threadpoolSize);
      return threadpoolSize;
    }
    if (sassConcurrency && sassConcurrency > cores) {
      concurrencyDebug(
        "%d sass jobs requested exceeds the %d cores in this machine," +
        " Ignoring user request.",
        sassConcurrency,
        cores);
      sassConcurrency = undefined;
    }

    if (sassConcurrency && sassConcurrency > physicalCores) {
      // Print a warning if physicalCores < sassConcurrency <= cores
      // But pretend the user knows what they're doing.
      concurrencyDebug(
        "WARNING: %d sass jobs requested exceeds the %d physical cores," +
        " this is probably slower as a result.",
        sassConcurrency,
        physicalCores)
    }

    if (!sassConcurrency) {
      concurrencyDebug(
        "Setting concurrency to the number of physical cores (%d).",
        physicalCores);
      sassConcurrency = physicalCores;
    }
    // The threadpool size is unset.
    // Set the threadpool size to match the requested concurrency.
    // unless this would shrink the default size of the pool
    if (sassConcurrency > 4) {
      concurrencyDebug(
        "Setting UV_THREADPOOL_SIZE to the concurrency level (%d).",
        sassConcurrency);
      process.env.UV_THREADPOOL_SIZE = sassConcurrency.toString();
    } else {
      concurrencyDebug(
        "Leaving UV_THREADPOOL_SIZE unset (the default is 4). " +
        "Sass will not use all available threads.");
    }
    return sassConcurrency;
  });
}