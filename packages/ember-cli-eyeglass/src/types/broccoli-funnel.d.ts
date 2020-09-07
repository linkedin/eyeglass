declare class Funnel {
  constructor(inputNode: any, _options: any);
  destDir: any;
  count: any;
  include: any;
  files: any;
  build(): void;
  canMatchWalk(): any;
  cleanup(): any;
  getCallbackObject(): any;
  includeFile(relativePath: any): any;
  lookupDestinationPath(relativePath: any): any;
  processFile(sourcePath: any, destPath: any): void;
  processFilters(inputPath: any): void;
  read(readTree: any): any;
  shouldLinkRoots(): any;
}

export = funnel;
declare function funnel(inputNode: any, options: any): Funnel;
declare namespace funnel {
  const Funnel: Funnel;
}

