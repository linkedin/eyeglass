# Integrating eyeglass and PostCSS
[PostCSS](https://github.com/postcss/postcss) is a powerful tool that transforms CSS using JavaScript plugins. You can use PostCSS in your favorite build tools such as [grunt](https://github.com/nDmitry/grunt-postcss), [gulp](https://github.com/postcss/gulp-postcss), [webpack](https://github.com/postcss/postcss-loader), [broccoli](https://github.com/jeffjewiss/broccoli-postcss), and others. Combining PostCSS with eyeglass gives you the best of both worlds.

Some examples of putting eyeglass and PostCSS together:
* Ship your styleguide as an npm module for eyeglass, then use [Autoprefixer](https://github.com/postcss/autoprefixer) for browser prefixes
* Use the Susy fluid grid, go "relative em" with [Pixrem](https://github.com/robwierzbowski/node-pixrem)
* Take your responsive design with multiple media queries and use [MQPacker](https://github.com/hail2u/node-css-mqpacker) to compress them down before minifying the CSS.
