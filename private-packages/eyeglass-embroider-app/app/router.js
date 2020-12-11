import EmbroiderRouter from '@embroider/router';
import config from './config/environment';

export default class Router extends EmbroiderRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.mount('eager-test-addon', { as: "eager" });
  this.mount('lazy-test-addon', { as: "lazy" });
});
