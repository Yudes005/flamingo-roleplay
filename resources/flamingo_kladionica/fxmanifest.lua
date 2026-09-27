fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'flamingo_kladionica'
author 'Flamingo Roleplay'
description 'Sportska kladionica sa pravim kvotama i utakmicama (The Odds API) - ESX Legacy, ox_inventory, ox_lib'
version '1.0.0'

shared_scripts {
    '@es_extended/imports.lua',
    '@ox_lib/init.lua',
    'config.lua',
}

client_scripts {
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'sv_config.lua',
    'server/util.lua',
    'server/api.lua',
    'server/db.lua',
    'server/odds.lua',
    'server/logos.lua',
    'server/settle.lua',
    'server/sync.lua',
    'server/main.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/app.js',
}

dependencies {
    'es_extended',
    'oxmysql',
    'ox_lib',
    'ox_inventory',
}
