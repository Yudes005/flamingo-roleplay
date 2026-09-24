fx_version 'cerulean'
game 'gta5'

dependency 'esx_keyprompt'
version '1.1.0'
lua54 'yes'

author 'Flamingo Scripts'
description 'Flamingo Supermarket - ESX market, klasicno E otvara shop direktno (bez dijaloga)'


shared_scripts {
    '@es_extended/imports.lua',
    'config.lua'
}

client_script 'client/main.lua'

server_scripts {
    '@es_extended/imports.lua',
    'server/main.lua'
}

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/fonts/*.woff2'
}

ui_page 'html/index.html'

dependencies {
    'es_extended',
    'ox_inventory',
    'esx_notify'
}
