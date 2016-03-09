module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    bower_concat: {
      all: {
        dest: 'build/_bower.js',
        cssDest: 'build/_bower.css',
        mainFiles: {
          bootstrap: ['dist/css/bootstrap.css', 'dist/css/bootstrap-theme.css'],
          'font-awesome': ['css/font-awesome.css'],
          'jquery-play-sound' : ['jquery.playSound.js'],
          literallycanvas : ['js/literallycanvas.min.js', 'css/literallycanvas.css']
        },
        bowerOptions: {
          relative: false,
          nonull: true
        }
      }
    },
    copy: {
      main: {
        files: [
          {expand: true, flatten: true, src: ['bower_components/font-awesome/fonts/*'], dest: 'webroot/fonts/', filter: 'isFile'},
          {expand: true, flatten: true, src: ['bower_components/bootstrap/fonts/*'], dest: 'webroot/fonts/', filter: 'isFile'},
          {expand: true, flatten: true, src: ['bower_components/mjolnic-bootstrap-colorpicker/dist/img/bootstrap-colorpicker/*'], dest: 'webroot/img/bootstrap-colorpicker', filter: 'isFile'},
          {expand: true, flatten: true, src: ['bower_components/literallycanvas/img/*'], dest: 'webroot/img/literallycanvas', filter: 'isFile'},
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-bower-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.registerTask('default', ['bower_concat:all', 'copy']);
};