let mix = require('laravel-mix');

mix.setPublicPath('./')
    .sass('assets/sass/popup.scss', 'dist/css')
    .sass('assets/sass/options.scss', 'dist/css')
    .js('assets/js/background.js', 'dist')
    .js('assets/js/popup.js', 'dist/js').vue()
    .js('assets/js/options.js', 'dist/js').vue()
    .copy('assets/images/', 'dist/images')
    .options({
        processCssUrls: false
    });
