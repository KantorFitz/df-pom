local status = '{'
status = status .. '\"isFortress\":\"' .. tostring(dfhack.world.isFortressMode()) .. '\",'
status = status .. '\"site\":\"' .. tostring(dfhack.world.getCurrentSite()) .. '\",'
status = status .. '\"paused\":\"' .. tostring(dfhack.world.ReadPauseState()) .. '\"'
status = status .. '}'
dfhack.internal.setClipboardTextCp437(status)
