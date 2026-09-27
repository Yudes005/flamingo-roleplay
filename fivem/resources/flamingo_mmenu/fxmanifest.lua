fx_version 'cerulean'
game 'gta5'

author 'FlamingoRoleplay'
description 'Flamingo M Menu - NUI shell (Battle Pass, Nagrade, Statistika i ostalo)'
version '1.2.0'

shared_scripts {
    'config.lua',
    'config_kutije.lua',
    'config_zadaci.lua'
}

client_scripts {
    'client/client.lua',
    'client/paketi.lua',
    'client/zadaci.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/server.lua',
    'server/paketi.lua',
    'server/zadaci.lua'
}

dependency 'ox_inventory'
dependency 'oxmysql'
dependency 'flamingo_progression'
dependency 'flamingo_achievements'
dependency 'flamingo_skills'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/style.css',
    'html/js/script.js',
    'html/js/paketi.js',
    'html/js/zvuk.js',
    'html/js/zadaci.js',
    'html/css/zadaci.css',
    'html/css/paketi.css',
    'html/img/*.png',
    'html/img/kutije/*.png',
    'html/img/kutije/*.jpg',
    'html/img/kutije/*.webp',
    'html/img/*.jpg',
    'html/img/*.svg',
    'html/img/money/*.png',
    'html/img/jobs/*.jpg',
    'html/img/jobs/*.png',
    'html/fonts/*.woff2',
    'html/vendor/fontawesome/css/*.css',
    'html/vendor/fontawesome/webfonts/*.woff2'
}
