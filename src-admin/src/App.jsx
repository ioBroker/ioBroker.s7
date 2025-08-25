import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { AppBar, Tabs, Tab, Paper, Typography } from '@mui/material';

import { I18n, Loader, GenericApp } from '@iobroker/adapter-react-v5';

import TabOptions from './Tabs/Options';
import TabInputs from './Tabs/Inputs';
import TabOutputs from './Tabs/Outputs';
import TabMarker from './Tabs/Marker';
import TabDbs from './Tabs/DBs';

import enLang from './i18n/en.json';
import deLang from './i18n/de.json';
import ruLang from './i18n/ru.json';
import ptLang from './i18n/pt.json';
import nlLang from './i18n/nl.json';
import frLang from './i18n/fr.json';
import itLang from './i18n/it.json';
import esLang from './i18n/es.json';
import plLang from './i18n/pl.json';
import ukLang from './i18n/uk.json';
import zhCnLang from './i18n/zh-cn.json';

const styles = {
    root: {},
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto',
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto',
    },
    tab: {
        width: '100%',
        minHeight: '100%',
    },
    selected: theme => ({
        color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
    }),
    indicator: theme => ({
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
    }),
};

const tabs = [
    {
        name: 'general',
        title: 'General',
        component: TabOptions,
    },
    {
        name: 'inputs',
        title: 'Inputs',
        component: TabInputs,
    },
    {
        name: 'outputs',
        title: 'Outputs',
        component: TabOutputs,
    },
    {
        name: 'marker',
        title: 'Marker',
        component: TabMarker,
    },
    {
        name: 'dbs',
        title: 'DBs',
        component: TabDbs,
    },
];

class App extends GenericApp {
    constructor(props) {
        const extendedProps = { ...props };
        extendedProps.encryptedFields = ['pass'];

        extendedProps.translations = {
            en: enLang,
            de: deLang,
            ru: ruLang,
            pt: ptLang,
            nl: nlLang,
            fr: frLang,
            it: itLang,
            es: esLang,
            pl: plLang,
            uk: ukLang,
            'zh-cn': zhCnLang,
        };

        extendedProps.sentryDSN = window.sentryDSN;

        super(props, extendedProps);
        this.state.moreLoaded = false;
        this.state.snackbar = null;
        this.state.rooms = null;
    }

    onConnectionReady() {
        super.onConnectionReady();
        this.socket.getForeignObjects('enum.rooms.*', 'enum').then(rooms => this.setState({ moreLoaded: true, rooms }));
    }

    getSelectedTab() {
        const selectedTab = this.state.selectedTab;
        if (!selectedTab) {
            return 0;
        } else {
            return tabs.findIndex(tab => tab.name === selectedTab);
        }
    }

    render() {
        if (!this.state.loaded || !this.state.moreLoaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <Loader theme={this.state.themeType} />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    {this.state.snackbar ? (
                        <div
                            style={{
                                zIndex: 10000,
                                position: 'absolute',
                                bottom: 10,
                                left: 10,
                            }}
                        >
                            <Paper
                                style={{
                                    backgroundColor:
                                        this.state.snackbar.options?.variant === 'error' ? 'red' : undefined,
                                }}
                            >
                                <Typography sx={{ p: 2 }}>{this.state.snackbar.text}</Typography>
                            </Paper>
                        </div>
                    ) : null}
                    <div
                        className="App"
                        style={{
                            background: this.state.theme.palette.background.default,
                            color: this.state.theme.palette.text.primary,
                        }}
                    >
                        <AppBar position="static">
                            <Tabs
                                value={this.getSelectedTab()}
                                onChange={(e, index) => this.selectTab(tabs[index].name, index)}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{ '& .MuiTabs-indicator': styles.indicator }}
                            >
                                {tabs.map(tab => (
                                    <Tab
                                        sx={{ '& .MuiTab-selected': styles.selected }}
                                        label={
                                            tab.icon ? (
                                                <>
                                                    {tab.icon}
                                                    {I18n.t(tab.title)}
                                                </>
                                            ) : (
                                                I18n.t(tab.title)
                                            )
                                        }
                                        data-name={tab.name}
                                        key={tab.name}
                                        title={tab.tooltip ? I18n.t(tab.tooltip) : undefined}
                                    />
                                ))}
                            </Tabs>
                        </AppBar>
                        <div style={this.isIFrame ? styles.tabContentIFrame : styles.tabContent}>
                            {tabs.map((tab, index) => {
                                const TabComponent = tab.component;
                                if (this.state.selectedTab) {
                                    if (this.state.selectedTab !== tab.name) {
                                        return null;
                                    }
                                } else {
                                    if (index !== 0) {
                                        return null;
                                    }
                                }
                                return (
                                    <TabComponent
                                        key={tab.name}
                                        themeType={this.state.themeType}
                                        common={this.common}
                                        socket={this.socket}
                                        native={this.state.native}
                                        onError={text =>
                                            this.setState({
                                                errorText:
                                                    (text || text === 0) && typeof text !== 'string'
                                                        ? text.toString()
                                                        : text,
                                            })
                                        }
                                        onLoad={native => this.onLoadConfig(native)}
                                        instance={this.instance}
                                        adapterName={this.adapterName}
                                        changed={this.state.changed}
                                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                                        changeNative={value =>
                                            this.setState({ native: value, changed: this.getIsChanged(value) })
                                        }
                                        rooms={this.state.rooms}
                                        showSnackbar={(text, options) =>
                                            this.setState({ snackbar: { text, options } }, () =>
                                                setTimeout(() => this.setState({ snackbar: null }), 3_000),
                                            )
                                        }
                                    />
                                );
                            })}
                        </div>
                        {this.renderError()}
                        {this.renderSaveCloseButtons()}
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}

export default App;
