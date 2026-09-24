![Logo](admin/s7.png)
# iobroker.s7

![Number of Installations](http://iobroker.live/badges/s7-installed.svg)
![Number of Installations](http://iobroker.live/badges/s7-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.s7.svg)](https://www.npmjs.com/package/iobroker.s7)

![Test and Release](https://github.com/ioBroker/iobroker.s7/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/s7/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.s7.svg)](https://www.npmjs.com/package/iobroker.s7)

## English
The Siemens S7 adapter is based on Snap7, with Snap7 when the
S7 adapter is also installed, and the actual S7 communication between ioBroker and the S7 is organized via TCP / IP.

It is therefore necessary that the S7 has an Ethernet interface
(integrated in the CPU or as a separate CP) and can communicate via TCP / IP with the hardware on which ioBroker is running.

It is assumed that the user has the necessary knowledge of TCP / IP communication
and is able to configure and program the S7 accordingly using Step7.
Proficient use of a PC and various operating systems is also a prerequisite.
These requirements are certainly not a challenge for someone
who is considering communication between ioBroker and an S7.

The format of the addresses for Inputs, Outputs or markers is "X.Y", where X is byte offset and Y is the bit offset in the byte.
The format of the addresses for DBs is `DBZ +X.Y`, where `z` is number of `DB`, like `DB34 +12.0`

### Installation
On some Linux systems, the build essentials must be installed to get this adapter work. You can install it with:

```
sudo apt-get update
sudo apt-get install build-essential
```

Under windows is Visual Studio 2013 (Community Edition is enough) or later is required to get it running.
Python 2.x is required too. Not 3.x.

## Time offset
You can use 4 time offset modes for S7TIME:
- Local: the time value will be not modified
- UTC: local time offset will be added to received time. E.g., for Germany: -60 Minutes in winter and -120 Minutes in summer.
- Set offset (use summer/winter): Given offset in minutes will be subtracted from received time and in summer additionally, 60 minutes will be subtracted.
- Set offset (no summer/winter): Just the given offset in minutes will be subtracted from received time. No matter in winter or in summer.

## S5TIME
S5 decoded as described here: http://www.plccenter.cn/Siemens_Step7/Format_des_Datentyps_S5TIME_Zeitdauer.htm

## Tia Portal
To use ioBroker with Tia Portal, ou need to disable the optimisation of blocks:

Right-click on the data block and then on 'Properties'. Under attributes, you will find the option "Optimized block access". Take off the hook.
After recompiling, the addresses are displayed in the data block ("Offset" column). 

You can read about it [here](https://github.com/ioBroker/ioBroker.s7/issues/113) too.

## More information
More description could be found [here](https://github.com/ioBroker/ioBroker.s7/blob/master/docs/en/s7.md).

## Deutsch
[German documentation](https://github.com/ioBroker/ioBroker.s7/blob/master/docs/de/s7.md)

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

## Changelog
### 3.0.2 (2026-09-24)
* (@GermanBluefox) Updated packages
* (@GermanBluefox) Because of snap7 no Node 26 support

### 3.0.0 (2026-08-04)
* IMPORTANT: js-controller 5+ is required to install this version!
* IMPORTANT: Migrated to TypeScript and Vite for GUI

### 1.5.0 (2025-08-25)
* (Apollon77) Dependency updates
* (bluefox) GUI was moved to vite

### 1.4.4 (2025-08-16)
* (Apollon77) Ensures that the adapter works with node.js 22.x and 24.x
* (bluefox) Updated GUI packages

### 1.4.3 (2024-02-17)
* (Bettman66) Fix REAL number parsing error

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
The MIT License (MIT)

Copyright (c) 2014-2026 bluefox <dogafox@gmail.com>,

Copyright (c) 2014-2016 smiling_Jack <steffen.schorling@googlemail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
