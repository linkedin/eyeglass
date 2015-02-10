'use strict';

module.exports = {
  merge_into: function(obj1, obj2) {
    for (var attr in obj2) {
      if (obj2.hasOwnProperty(attr)) obj1[attr] = obj2[attr];
    }
  }
};
