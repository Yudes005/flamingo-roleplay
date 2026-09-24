fx_version 'cerulean'
game 'gta5'

author 'Flamingo Roleplay'
description 'Flamingo Radial Menu (G) - kruzni meni + Dokumenti + Upoznaj se + Kuce'
version '3.0.0'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js'
}

client_scripts {
    'client.lua'
}

server_scripts {
    'server.lua'
}

-- flamingo_documents mora biti pokrenut PRE ovog resursa u server.cfg.
dependencies {
    'es_extended',
    'oxmysql',
    'flamingo_documents'
}

lua54 'yes'
