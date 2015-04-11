module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json')
  });
  grunt.loadNpmTasks('grunt-release');

  grunt.registerTask('default', []);
};
