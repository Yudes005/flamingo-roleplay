fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'flamingo_graphics'
author 'Flamingo Roleplay'
description 'Lepsa grafika za sve igrace: custom timecycle preseti, dan/noc izgled, LOD, senke i svetla vozila. Podesava se kroz M meni.'
version '2.0.0'

files {
    'data/timecycle_mods_flamingo.xml'
}

data_file 'TIMECYCLEMOD_FILE' 'data/timecycle_mods_flamingo.xml'

shared_script 'config.lua'
client_script 'client.lua'
