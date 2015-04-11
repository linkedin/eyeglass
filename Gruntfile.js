module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    release: {
      options: {
        bump: false
      }
    }
  });
  grunt.loadNpmTasks('grunt-release');

  grunt.registerTask('default', []);
};
