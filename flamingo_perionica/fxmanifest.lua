fx_version 'cerulean'
use_experimental_fxv2_oal 'yes'
lua54 'yes'
game 'gta5'

name 'flamingo_perionica'
author 'Flamingo RP'
version '1.0.0'
description 'Auto perionica - NUI meni sa paketima pranja, [E] prompt preko esx_keyprompt, naplata preko ESX naloga (kes/banka)'

dependencies {
    'ox_lib',
    'es_extended',
    'esx_keyprompt',
    'esx_notify',
    'flamingo_progressbar',
}

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
}
