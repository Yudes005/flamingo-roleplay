fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'ESX Phone Design'
description 'Flamingo Telefon 2.0 - iPhone stil'
version '2.0.0'

-- NAPOMENA: pozivi preko telefona koriste pma-voice (exports['pma-voice']:setPlayerCall)
-- da spoje sagovornike glasom. Nije tvrda zavisnost (nema "dependency" liniju) jer se
-- kod ponasa bezbedno i bez njega (samo se glasovni deo poziva preskace) - ali za pravi
-- glasovni razgovor, pma-voice MORA biti pokrenut PRE ovog resursa u server.cfg.

client_script 'client/client.lua'
server_script 'server/server.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/img/*.jpg',
    'html/img/wallpapers/*.jpg',
    'html/fonts/*.woff2',
    'html/vendor/fontawesome/css/*.css',
    'html/vendor/fontawesome/webfonts/*.woff2',
}
