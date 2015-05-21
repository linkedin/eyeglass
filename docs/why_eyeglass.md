# Why eyeglass?
eyeglass fills a need for `node-sass` users: access to the rich Sass ecosystem using well-tested node.js development tools. The Sass community has numerous plugins, including [compass](http://compass-style.org), [Susy](http://susy.oddbird.net), [Bourbon](http://bourbon.io), and [many more](http://www.sache.in). By standardizing on eyeglass, we will bring many of these modules to `node-sass` users of the community and make them installable from a simple `npm install`.

# Why Does eyeglass Wrap Options?
The decision to try and transparently wrap the `node-sass` options collection was made in order to reduce the total number of tools and plugins the team would need to make. Since there is support for Custom Functions and Importers, all of the language pieces eyeglass needs are already available at the `node-sass` level.

More involved build systems such as Broccoli (and thus ember-cli) contain their own asset pipeline logic. The introduction of eyeglass-* plugins in these cases were to ensure any additional assets an eyeglass module might create are properly captured in the system.

# Why Is eyeglass Handling Assets?
Assets (sprites, fonts, images, etc) are inherently complex items. When you build a CSS file with `node-sass`, you may want to change local paths into CDN locations, move files around, or otherwise create new items from your raw sources. If we didn't put this into eyeglass' core, we would have made an `eyeglass-assets` module. However, there's so much configuration in the assets themselves (based on our experience with compass), that we felt asset management should be part of eyeglass' core behaviors.

Key discussions on the topic:
* [Asset Installation](https://github.com/sass-eyeglass/eyeglass/issues/15)
* [General Design](https://github.com/sass-eyeglass/eyeglass-assets/issues/1)

# Why A /docs Directory?
The `/docs` directory exists so that you can both (1) get the documentation when you check out the code or `npm install` eyeglass, and (2) ensure up-to-date documentation is coming in with pull requests. Too often, the code will get out of sync with a wiki, causing pain for everyone involved. This is a good hygiene practice that the `node-sass` and `libsass` teams are moving towards, and we think this is a good direction as well.
