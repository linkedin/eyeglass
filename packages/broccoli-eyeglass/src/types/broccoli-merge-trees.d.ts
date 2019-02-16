import BroccoliPlugin = require("broccoli-plugin");
export = MergeTrees;
interface MergeTreesOptions extends BroccoliPlugin.BroccoliPluginOptions {
  overwrite: boolean;
}
declare class MergeTrees extends BroccoliPlugin {
  constructor(inputNodes: BroccoliPlugin.BroccoliNode[], options: MergeTreesOptions);
  inputNodes: BroccoliPlugin.BroccoliNode[];
  options: MergeTreesOptions;
}
