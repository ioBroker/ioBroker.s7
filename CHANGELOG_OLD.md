# Older changes
## 1.4.2 (2023-12-04)
* IMPORTANT: Node.js 16+ is required to run this version!
* (Apollon77) Update dependencies to make adapter work with Node.js 20+

## 1.3.15 (2022-12-23)
* (bluefox) Updated GUI packages
* (bluefox) Added ukrainian translation

## 1.3.14 (2022-09-27)
* (bluefox) Updated GUI packages

## 1.3.13 (2022-08-02)
* (bluefox) Added preparations for ioBroker cloud
* (bluefox) Migrate GUI tu muiV5

## 1.3.12 (2022-04-03)
* (jogibear9988) Removed duplicated code
* (jogibear9988) Implemented S5TIME support (must be tested on a real device)

## 1.3.11 (2022-02-13)
* (bluefox) Updated releaser

## 1.3.10 (2021-11-13)
* (Apollon77) Better handle invalid entries with empty Address

## 1.3.9 (2021-11-09)
* (Apollon77) make sure strings work correctly
* (Apollon77) Fix several crash cases (IOBROKER-S7-17, IOBROKER-S7-19, IOBROKER-S7-1C, IOBROKER-S7-18)

## 1.3.7 (2021-11-08)
* (bluefox) Corrected type of "write" attribute

## 1.3.6 (2021-07-31)
* (bluefox) Corrected import of last line

## 1.3.5 (2021-07-07)
* (bluefox) Change edit mode behaviour

## 1.3.3 (2021-06-28)
* (bluefox) Corrected the error in GUI

## 1.3.2 (2021-06-23)
* (Apollon77) Add adapter tier for js-controller 3.3

## 1.3.1 (2021-06-23)
* (bluefox) Corrected the type of states

## 1.3.0 (2021-06-17)
* (bluefox) New configuration page on react

## 1.2.5 (2021-04-17)
* (Apollon77) Fix pot crash case (Sentry IOBROKER-S7-16)

## 1.2.4 (2021-02-22)
* (Apollon77) Make sure data are of correct type (Sentry IOBROKER-S7-K)

## 1.2.3 (2021-02-17)
* (Apollon77) null values will no longer be tried to send but give error message (Sentry IOBROKER-S7-8)
* (Apollon77) Prevent some more crash cases (IOBROKER-S7-1, IOBROKER-S7-9, IOBROKER-S7-E, IOBROKER-S7-F, IOBROKER-S7-G)

## 1.2.2 (2021-01-26)
* (Apollon77) Prevent warnings in js-controller 3.2

## 1.2.1 (2021-01-25)
* (Apollon77) fix `info.connection` state

## 1.2.0 (2021-01-25)
* (Apollon77) Prevent error case (Sentry IOBROKER-S7-4)
* (Apollon77) js-controller 2.0 is now required at minimum

## 1.1.10 (2021-01-24)
* (smiling_Jack) Bugfix in the Admin

## 1.1.9 (2020-08-02)
* (Apollon77) Fix object access issue
* (Apollon77) update node-snap7 library

## 1.1.8 (2020-05-05)
* (Steff42) Make sure objects ids/names are strings

## 1.1.6 (2019.12.27)
* (Apollon77) reconnection handling on timeouts optimized

## 1.1.4 (2018.07.10)
* (Apollon77) Support for nodejs 10 on Windows

## 1.1.3 (2018.01.19)
* (bluefox) The time offset was added

## 1.1.1 (2018.01.05)
* (Apollon77) Fix LOGO! support

## 1.1.0 (2018.01.03)
* (bluefox) Fix strings
* (bluefox) fix names if they have more than one space

## 1.0.6 (2017.12.18)
* (bluefox) Decode error codes

## 1.0.5 (2017.12.17)
* (bluefox) Error by the DB import is fixed

## 1.0.4 (2017.11.30)
* (bluefox) Fix read of DB (range error)

## 1.0.2 (2017.10.30)
* (Apollon77) Enhance object data to allow writing if available
* (bluefox) Add export from Graphpic

## 1.0.1 (2017.10.24)
* (bluefox) Detect DB and db in addresses

## 1.0.0 (2017.09.25)
* (bluefox) Activate save button if something was deleted

## 0.3.2 (2017.09.20)
* (bluefox) Fix DB bit offset bug if starting not from 0

## 0.3.0 (2017.07.12)
* (Apollon77) Upgrade node-snap7 library to current version

## 0.2.6 (2017.05.19)
* (Apollon77) Fix history handling

## 0.2.5 (2016.12.09)
* (bluefox) Fix button text: Import

## 0.2.4 (2015.10.29)
* (bluefox) add comment about python
* (bluefox) implement string read and write
* (bluefox) implement auto-increment of addresses.
* (bluefox) fix length
* (bluefox) implement export import from/to CSV
* (bluefox) fix small errors in config
* (bluefox) implement import/export for inputs and outputs too.
* (bluefox) add translation

## 0.2.3 (2015.09.24)
* (bluefox) added support of Logo!

## 0.2.2 (2015.09.11)
* (bluefox) add S7time
* (bluefox) support rooms and roles
* (bluefox) it works
* (bluefox) update packets

## 0.2.1 (2015.09.09)
* (bluefox) fix creation of objects

## 0.2.0 (2015.08.15)
* (bluefox) improve performance and enable DB2 3.9 addresses.

## 0.1.8 (2015.08.10)
* (smiling_Jack) Bugfix send info states
* (smiling_Jack) Remove unneeded console.log

## 0.1.7 (2015.08.06)
* (smiling_Jack) Bugfix send to SPS
* (smiling_Jack) Bugfix reconnect on connection lost

## 0.1.6 (2015.07.31)
* (smiling_Jack) Bugfix typo (Adress, Merkers)

## 0.1.5 (2015.07.29)
* (smiling_Jack) Bugfix translation Admin

## 0.1.4 (2015.07.28)
* (smiling_Jack) Add S5Time as Type
* (smiling_Jack) Bugfix History
* (smiling_Jack) Bugfix (fast value change)

## 0.1.3 (2015.06.04)
* (bluefox) translate admin
* (bluefox) remove jshint warnings
* (bluefox) add `info.connected` and rename `info.connection` to `info.state`

## 0.1.2
* Bugfix startup
* Bugfix add states

## 0.1.1
* change import options

## 0.1.0
* redesign Admin UI
* add write as Pulse
* Bugfix delete unused objects

## 0.0.8
* Bugfix start file
* Bugfix DB import
* Working on Admin style
* Add Units

## 0.0.6
* Bugfix start file
