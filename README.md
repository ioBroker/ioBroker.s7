![Logo](admin/S7.png)
### iobroker.s7

Der Siemens S7 Adapter basiert auf Snap7, wobei Snap7 bei der Erstinstallation des S7 Adapters mitinstalliert wird und die eigentliche S7-Kommunikation zwischen ioBroker und der S7 ?ber TCP/IP organisiert.

Es ist also notwendig, dass die S7 ?ber eine Ethernet-Schnittstelle verf?gt (in der CPU integriert oder als separater CP) und ?ber TCP/IP mit der Hardware kommunizieren kann, auf der ioBroker l?uft.

Es wird vorausgesetzt, dass der Anwender ?ber die notwendigen Kenntnisse zur TCP/IP-Kommunikation verf?gt und in der Lage ist, die S7 mittels Step7 entsprechend zu konfigurieren und zu programmieren. Der ge?bte Umgang mit PC und verschiedenen Betriebssystem ist ebenfalls Voraussetzung. Diese Anforderungen stellen sicherlich keine Herausforderung f?r jemanden dar, der die Kommunikation zwischen ioBroker und einer S7 in Erw?gung zieht.

#0.1.7 [2015.08.06]
* (smiling_Jack) Bugfix send to SPS
* (smiling_Jack) Bugfix reconnect on connection lost

#0.1.6 [2015.07.31]
* (smiling_Jack) Bugfix typo (Adress, Merkers)

#0.1.5 [2015.07.29]
* (smiling_Jack) Bugfix translation Admin

#0.1.4 [2015.07.28]
* (smiling_Jack) Add S5Time as Type
* (smiling_Jack) Bugfix History
* (smiling_Jack) Bugfix (fast value change)

#0.1.3 [2015.06.04]
* (bluefox) translate admin
* (bluefox) remove jshint warnings
* (bluefox) add info.connected and rename info.connection to info.state

#0.1.2
* Bugfix startup
* Bugfix add states

#0.1.1
* change import options

#0.1.0
* redesign Admin UI
* add write as Pulse
* Bugfix delete unused objects

#0.0.8
* Bugfix start file
* Bugfix DB import
* Working on Admin style
* Add Units

#0.0.6
* Bugfix start file