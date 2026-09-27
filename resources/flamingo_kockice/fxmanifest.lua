fx_version 'cerulean'
game 'gta5'

name 'flamingo_kockice'
author 'Flamingo RP'
description 'Flamingo - kockice 1v1 za novac (radial meni G -> Osnovne akcije -> Kockice)'
version '1.0.0'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/script.js'
}

shared_scripts {
    'config.lua'
}

client_scripts {
    'client.lua'
}

server_scripts {
    'server.lua'
}

-- flamingo_input i flamingo_odbiprihvati moraju biti pokrenuti PRE ovog resursa.
dependencies {
    'es_extended',
    'flamingo_input',
    'flamingo_odbiprihvati'
}

lua54 'yes'
