fx_version 'cerulean'
use_experimental_fxv2_oal 'yes'
lua54 'yes'
game 'gta5'

name 'flamingo_pumpa'
author 'Flamingo RP'
version '1.0.0'
description 'Custom NUI meni za pumpu (radi sa ox_fuel) - sipanje goriva na litre + kanister, E prompt preko esx_keyprompt, notifikacije preko esx_notify'

dependencies {
    'ox_lib',
    'ox_inventory',
    'es_extended',
    'esx_keyprompt',
    'esx_notify',
    'ox_fuel',
}

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'html/index.html'

files {
    'data/stations.lua',
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/kanister.png',
    'html/repairkit.png',
}
