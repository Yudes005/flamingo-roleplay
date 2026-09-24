fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Flamingo Roleplay'
description 'flamingo_banke - banka (gotovina + bankovni racun) za ESX'
version '2.0.0'

shared_scripts {
    '@es_extended/imports.lua',
    'config.lua'
}

client_script 'client.lua'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server.lua'
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
