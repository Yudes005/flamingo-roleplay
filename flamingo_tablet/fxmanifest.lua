fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'ESX Phone Design'
description 'Flamingo Tablet - Bolnica, Lifeinvader i Organizacija (lider/clan, Zahtevi za Vladu), MDT Vlada + MDT Policija aplikacije + frame/pozadina'
version '0.7.0'

dependencies {
    'es_extended',
    'esx_notify'
}

shared_scripts {
    '@es_extended/imports.lua'
}

client_script 'client/client.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/kuce.js',
    'html/kuce.css',
    'html/market.js',
    'html/market.css',
    'html/fmdt.css',
    'html/mdt_core.js',
    'html/mdt_vlada.js',
    'html/mdt_policija.js',
    'html/img/wallpaper.jpg',
    'html/fontawesome/css/fontawesome.min.css',
    'html/fontawesome/css/solid.min.css'
}
