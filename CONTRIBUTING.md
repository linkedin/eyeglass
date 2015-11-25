Thanks for contributing! Check back here for more info to come.

# Website

The documentation, site content, and styles can be found in `./site/`

## Building

```sh
gulp site
```

## Deploying locally

```sh
gulp site:dev
```

### Staging

To test against a more prod-like environment (e.g. minified, etc), use `gulp site:staging` to deploy the staging server locally.

## Deploying to production

```sh
gulp site:deploy
```

### Dry run

To do a dry run before deploying to production, run `gulp site:deploy:dry`

## `eyeglass-dev-site-builder`

While the content is here in the main repo, the metalsmith site builder is actually in a separate project. This project is responsible for the actual build interface and is consumed as a dependency.

If you need to make changes beyond what's exposed via the config interface, you'll want to look at [`eyeglass-dev-site-builder`](https://github.com/sass-eyeglass/eyeglass-dev-site-builder).
