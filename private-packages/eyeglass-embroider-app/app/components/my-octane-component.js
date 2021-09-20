import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class MyOctaneComponentComponent extends Component {
  @tracked
  fooBarBaz = false;

  @action
  toggle() {
    this.fooBarBaz = !this.fooBarBaz;
  }
}
