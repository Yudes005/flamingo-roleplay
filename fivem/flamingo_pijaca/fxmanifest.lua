fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'flamingo_pijaca'
author 'flamingo'
description 'Pijaca - iznajmljivanje tezgi za igrace (ESX + ox_inventory)'
version '1.0.0'

shared_scripts {
    'config.lua'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    'server/main.lua'
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js'
}

dependencies {
    'es_extended',
    'ox_inventory',
    'esx_notify',
    'esx_keyprompt',
    'flamingo_npcdialog'
}
