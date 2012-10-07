del *.ipk
call palm-package package application srv
call palm-install *.ipk
REM call palm-launch -p "{mojoConfig: {debuggingEnabled:true}}" info.mobo.syncml
