fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Flamingo Roleplay'
description 'flamingo_biznisi - biznisi (za sada bankomati): kupovina, kasa, provizija, gotovina u bankomatu'
version '1.0.0'

shared_scripts {
    '@es_extended/imports.lua',
    'config.lua'
}

client_script 'client/main.lua'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/app.js'
}

dependencies {
    'es_extended',
    'oxmysql',
    'esx_notify',
    'esx_keyprompt'
}
